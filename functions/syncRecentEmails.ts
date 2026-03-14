import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import OpenAI from 'npm:openai@4.104.0';

const llmClient = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: Deno.env.get('NVIDIA_API_KEY'),
});

const CATEGORY_MAP = new Set([
  'da_rispondere',
  'marketing',
  'notifica',
  'da_seguire',
  'per_conoscenza',
  'pec',
  'burocrazia',
  'contratto',
  'newsletter',
  'altro',
]);

const defaultTopicStates = {
  accounts: true,
  coldOutreach: false,
  comment: true,
  contract: true,
  event: true,
  notetaker: true,
  meeting: true,
  newsletter: true,
  orders: true,
  payment: true,
  promotion: false,
  submission: true,
  toolAlert: true,
  pec: true,
  burocrazia: true,
};

function decodeBase64Url(value = '') {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  return atob(normalized);
}

function extractTextFromPayload(part) {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  return (part.parts || []).map(extractTextFromPayload).join('\n');
}

function parseAddress(from = '') {
  const match = from.match(/^(.*?)\s*<(.+)>$/);
  if (!match) {
    return { fromName: from, fromEmail: from };
  }
  return {
    fromName: (match[1] || '').trim().replace(/^"|"$/g, ''),
    fromEmail: match[2] || from,
  };
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

async function getInboxSettings(base44, user) {
  const existing = await base44.asServiceRole.entities.InboxSettings.filter({ user_id: user.id });
  return existing[0] || {
    move_notification_out: true,
    move_follow_up_out: true,
    move_marketing_out: true,
    keep_todo_in_inbox: false,
    keep_fyi_in_inbox: false,
    respect_existing_categories: true,
    enable_topic_labels: true,
    enable_categorization: true,
    marketing_filter_mode: 'cold_unknown',
    topic_states: defaultTopicStates,
    alternative_emails: [],
    custom_rules: [],
  };
}

function passesCustomRules(settings, fromEmail, subject, snippet) {
  const rules = Array.isArray(settings.custom_rules) ? settings.custom_rules : [];
  const searchable = `${fromEmail} ${subject} ${snippet}`.toLowerCase();
  for (const rule of rules) {
    const pattern = String(rule?.pattern || '').trim().toLowerCase();
    const category = String(rule?.category || '').trim();
    if (!pattern || !CATEGORY_MAP.has(category)) continue;
    if (searchable.includes(pattern)) return category;
  }
  return null;
}

function applyTopicState(category, settings) {
  if (!settings.enable_topic_labels) return category;
  const topicStates = settings.topic_states || defaultTopicStates;
  const categoryToTopic = {
    newsletter: 'newsletter',
    pec: 'pec',
    burocrazia: 'burocrazia',
    contratto: 'contract',
    marketing: settings.marketing_filter_mode === 'all' ? 'promotion' : 'coldOutreach',
    notifica: 'toolAlert',
  };
  const topicKey = categoryToTopic[category];
  if (topicKey && topicStates[topicKey] === false) {
    return 'altro';
  }
  return category;
}

function categoryFromAlternativeEmail(settings, fromEmail) {
  const alternatives = Array.isArray(settings.alternative_emails) ? settings.alternative_emails.map(normalizeEmail) : [];
  return alternatives.includes(normalizeEmail(fromEmail)) ? 'da_seguire' : null;
}

async function categorizeEmail(settings, fromEmail, subject, snippet) {
  const alternativeCategory = categoryFromAlternativeEmail(settings, fromEmail);
  if (alternativeCategory) {
    return applyTopicState(alternativeCategory, settings);
  }

  const customCategory = passesCustomRules(settings, fromEmail, subject, snippet);
  if (customCategory) {
    return applyTopicState(customCategory, settings);
  }

  if (!settings.enable_categorization) {
    return 'altro';
  }

  const prompt = `Categorizza questa email in italiano.
Scegli UNA categoria tra: da_rispondere, marketing, notifica, da_seguire, per_conoscenza, pec, burocrazia, contratto, newsletter, altro.

Regole builder:
- marketing_filter_mode: ${settings.marketing_filter_mode}
- keep_todo_in_inbox: ${settings.keep_todo_in_inbox}
- keep_fyi_in_inbox: ${settings.keep_fyi_in_inbox}
- respect_existing_categories: ${settings.respect_existing_categories}
- alternative_emails: ${(settings.alternative_emails || []).join(', ') || 'none'}
- custom_rules_count: ${(settings.custom_rules || []).length}

Mittente: ${fromEmail}
Oggetto: ${subject}
Anteprima: ${snippet}

Rispondi solo con il nome esatto della categoria.`;

  const completion = await llmClient.chat.completions.create({
    model: 'minimaxai/minimax-m2.1',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    top_p: 0.95,
    max_tokens: 50,
  });

  const candidate = (completion.choices?.[0]?.message?.content || '').trim().toLowerCase();
  const normalized = CATEGORY_MAP.has(candidate) ? candidate : 'altro';
  return applyTopicState(normalized, settings);
}

function shouldArchiveFromInbox(category, settings) {
  if (category === 'marketing') return settings.move_marketing_out;
  if (category === 'notifica') return settings.move_notification_out;
  if (category === 'da_seguire') return settings.move_follow_up_out;
  if (category === 'da_rispondere') return !settings.keep_todo_in_inbox;
  if (category === 'per_conoscenza') return !settings.keep_fyi_in_inbox;
  return false;
}

async function getLabelMap(accessToken, cache) {
  if (cache.labelMap) return cache.labelMap;
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    cache.labelMap = {};
    return cache.labelMap;
  }
  const data = await res.json();
  cache.labelMap = Object.fromEntries((data.labels || []).map((label) => [label.name, label.id]));
  return cache.labelMap;
}

async function ensureMailMindLabel(accessToken, category, cache) {
  if (!category || category === 'altro') return null;
  const labelName = `MailMind/${category}`;
  const labelMap = await getLabelMap(accessToken, cache);
  if (labelMap[labelName]) return labelMap[labelName];

  const createRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/labels', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: labelName,
      labelListVisibility: 'labelShow',
      messageListVisibility: 'show',
    }),
  });

  if (!createRes.ok) return null;
  const created = await createRes.json();
  labelMap[labelName] = created.id;
  return created.id;
}

async function applyMailboxPreferences(accessToken, messageId, labelIds, category, settings, cache) {
  const addLabelIds = [];
  const removeLabelIds = [];

  const labelId = settings.enable_topic_labels ? await ensureMailMindLabel(accessToken, category, cache) : null;
  if (labelId && !labelIds.includes(labelId)) {
    addLabelIds.push(labelId);
  }

  if (shouldArchiveFromInbox(category, settings) && labelIds.includes('INBOX')) {
    removeLabelIds.push('INBOX');
  }

  if (addLabelIds.length === 0 && removeLabelIds.length === 0) {
    return;
  }

  await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const maxResults = Math.min(Math.max(payload.max_results || 25, 1), 100);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const headers = { Authorization: `Bearer ${accessToken}` };
    const inboxSettings = await getInboxSettings(base44, user);
    const gmailCache = {};

    const listRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=${maxResults}&q=-label:SENT -label:DRAFT`, { headers });
    if (!listRes.ok) {
      return Response.json({ error: await listRes.text() }, { status: 502 });
    }

    const listData = await listRes.json();
    const messages = listData.messages || [];
    const processed = [];

    for (const item of messages) {
      const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}?format=full`, { headers });
      if (!msgRes.ok) continue;
      const msg = await msgRes.json();
      const labelIds = msg.labelIds || [];
      if (labelIds.includes('SENT') || labelIds.includes('DRAFT')) continue;

      const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({ message_id: item.id });
      if (existingThreads.length > 0) continue;

      const headersList = msg.payload?.headers || [];
      const getHeader = (name) => headersList.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || '';
      const subject = getHeader('Subject');
      const from = getHeader('From');
      const { fromName, fromEmail } = parseAddress(from);
      const snippet = msg.snippet || '';
      const body = extractTextFromPayload(msg.payload).slice(0, 5000);
      const category = await categorizeEmail(inboxSettings, fromEmail, subject, snippet);

      const createdThread = await base44.asServiceRole.entities.EmailThread.create({
        thread_id: msg.threadId,
        message_id: item.id,
        subject,
        from_email: fromEmail,
        from_name: fromName,
        snippet,
        body,
        received_at: new Date(parseInt(msg.internalDate, 10)).toISOString(),
        category,
        status: 'nuovo',
        labels: labelIds,
      });

      await applyMailboxPreferences(accessToken, item.id, labelIds, category, inboxSettings, gmailCache);

      const shouldGenerateDraft = ['da_rispondere', 'contratto'].includes(category) && body;
      if (shouldGenerateDraft) {
        await base44.asServiceRole.functions.invoke('draftGenerator', {
          thread_id: msg.threadId,
          message_id: item.id,
          subject,
          from_email: fromEmail,
          body: body.slice(0, 3000),
          user_id: user.id,
          account_email: user.email,
        });
      }

      processed.push(createdThread.id);
    }

    return Response.json({ success: true, processed_count: processed.length, processed_ids: processed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});