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

async function getInboxSettings(base44, userEmail) {
  const users = await base44.asServiceRole.entities.User.filter({ email: userEmail });
  const user = users[0];
  if (!user) {
    return {
      settings: {
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
      },
      userId: null,
    };
  }

  const existing = await base44.asServiceRole.entities.InboxSettings.filter({ user_id: user.id });
  return {
    settings: existing[0] || {
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
    },
    userId: user.id,
  };
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

function extractText(part) {
  if (!part) return '';
  if (part.mimeType === 'text/plain' && part.body?.data) {
    return decodeBase64Url(part.body.data);
  }
  return (part.parts || []).map(extractText).join('\n');
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
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

  const completion = await llmClient.chat.completions.create({
    model: 'minimaxai/minimax-m2.1',
    messages: [{
      role: 'user',
      content: `Categorizza questa email in italiano.
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

Rispondi solo con il nome esatto della categoria.`
    }],
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
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const encodedMessage = body?.data?.message?.data;
    if (!encodedMessage) {
      return Response.json({ error: 'Invalid Gmail webhook payload' }, { status: 400 });
    }

    const decoded = JSON.parse(atob(encodedMessage));
    const currentHistoryId = String(decoded.historyId);
    const accountEmail = decoded.emailAddress || '';
    const { settings, userId } = await getInboxSettings(base44, accountEmail);
    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };
    const gmailCache = {};

    const syncStates = await base44.asServiceRole.entities.SyncState.list();
    const syncRecord = syncStates.find((item) => (item.account_email || '') === accountEmail) || null;

    if (!syncRecord) {
      await base44.asServiceRole.entities.SyncState.create({
        history_id: currentHistoryId,
        account_email: accountEmail,
      });
      return Response.json({ status: 'initialized', historyId: currentHistoryId });
    }

    const historyRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${syncRecord.history_id}&historyTypes=messageAdded`,
      { headers: authHeader },
    );

    if (historyRes.status === 404) {
      await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
        history_id: currentHistoryId,
        account_email: accountEmail,
      });
      return Response.json({ status: 'history_reset', historyId: currentHistoryId });
    }

    if (!historyRes.ok) {
      return Response.json({ error: await historyRes.text() }, { status: 500 });
    }

    const historyData = await historyRes.json();
    const histories = historyData.history || [];
    const processedIds = [];

    for (const history of histories) {
      for (const added of history.messagesAdded || []) {
        const msgId = added.message.id;
        const msgRes = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`, { headers: authHeader });
        if (!msgRes.ok) continue;

        const msg = await msgRes.json();
        const labelIds = msg.labelIds || [];
        if (labelIds.includes('SENT') || labelIds.includes('DRAFT')) continue;

        const headersList = msg.payload?.headers || [];
        const getHeader = (name) => headersList.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || '';
        const subject = getHeader('Subject');
        const { fromName, fromEmail } = parseAddress(getHeader('From'));
        const snippet = msg.snippet || '';
        const bodyText = extractText(msg.payload).slice(0, 5000);
        const category = await categorizeEmail(settings, fromEmail, subject, snippet);

        const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({ thread_id: msg.threadId });
        const existingThread = existingThreads[0] || null;

        const threadPayload = {
          thread_id: msg.threadId,
          message_id: msgId,
          subject,
          from_email: fromEmail,
          from_name: fromName,
          snippet,
          body: bodyText,
          received_at: new Date(parseInt(msg.internalDate, 10)).toISOString(),
          category,
          status: 'nuovo',
          labels: labelIds,
        };

        let threadRecord = existingThread;
        if (existingThread) {
          if (!(settings.respect_existing_categories && existingThread.category)) {
            threadRecord = await base44.asServiceRole.entities.EmailThread.update(existingThread.id, threadPayload);
          }
        } else {
          threadRecord = await base44.asServiceRole.entities.EmailThread.create(threadPayload);
        }

        await applyMailboxPreferences(accessToken, msgId, labelIds, category, settings, gmailCache);

        const shouldGenerateDraft = ['da_rispondere', 'contratto'].includes(category)
          && bodyText
          && userId
          && (!threadRecord?.draft_id || threadRecord.message_id !== msgId);

        if (shouldGenerateDraft) {
          await base44.asServiceRole.functions.invoke('draftGenerator', {
            thread_id: msg.threadId,
            message_id: msgId,
            subject,
            from_email: fromEmail,
            body: bodyText.slice(0, 3000),
            user_id: userId,
            account_email: accountEmail,
          });
        }

        processedIds.push(msgId);
      }
    }

    await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
      history_id: currentHistoryId,
      account_email: accountEmail,
    });

    return Response.json({ status: 'ok', processed: processedIds.length, message_ids: processedIds });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});