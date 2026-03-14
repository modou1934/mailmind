import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GEMINI_MODEL = 'gemini-3-flash-preview';
const CATEGORY_MAP = new Set(['da_rispondere', 'marketing', 'notifica', 'da_seguire', 'per_conoscenza', 'pec', 'burocrazia', 'contratto', 'newsletter', 'altro']);

async function callGemini(prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, topP: 0.95, maxOutputTokens: 50 },
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
}

async function refreshMicrosoftToken(token) {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('MICROSOFT_CLIENT_ID')?.trim(),
      client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')?.trim(),
      refresh_token: token.refresh_token,
      grant_type: 'refresh_token',
      scope: 'openid email offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send',
    }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error_description || data.error);
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token || token.refresh_token,
    expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
  };
}

async function getMicrosoftAccessToken(base44, token) {
  if (token.expires_at && new Date(token.expires_at).getTime() > Date.now() + 60000) {
    return token.access_token;
  }
  const refreshed = await refreshMicrosoftToken(token);
  await base44.asServiceRole.entities.UserOAuthToken.update(token.id, refreshed);
  return refreshed.access_token;
}

function htmlToText(html = '') {
  return String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

async function getInboxSettings(base44, userId) {
  const existing = await base44.asServiceRole.entities.InboxSettings.filter({ user_id: userId });
  return existing[0] || {
    enable_categorization: true,
    marketing_filter_mode: 'cold_unknown',
    alternative_emails: [],
    custom_rules: [],
  };
}

function normalizeEmail(email = '') {
  return String(email).trim().toLowerCase();
}

function matchCustomRule(settings, fromEmail, subject, snippet) {
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

async function categorizeEmail(settings, fromEmail, subject, snippet) {
  const alternativeEmails = Array.isArray(settings.alternative_emails) ? settings.alternative_emails.map(normalizeEmail) : [];
  if (alternativeEmails.includes(normalizeEmail(fromEmail))) return 'da_seguire';
  const customCategory = matchCustomRule(settings, fromEmail, subject, snippet);
  if (customCategory) return customCategory;
  if (!settings.enable_categorization) return 'altro';

  const prompt = `Categorizza questa email in italiano. Scegli UNA categoria tra: da_rispondere, marketing, notifica, da_seguire, per_conoscenza, pec, burocrazia, contratto, newsletter, altro.\n\nMittente: ${fromEmail}\nOggetto: ${subject}\nAnteprima: ${snippet}\n\nRispondi solo con il nome esatto della categoria.`;
  const candidate = (await callGemini(prompt)).toLowerCase();
  return CATEGORY_MAP.has(candidate) ? candidate : 'altro';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const tokens = await base44.asServiceRole.entities.UserOAuthToken.filter({ user_id: user.id, provider: 'microsoft' });
    const token = tokens[0];
    if (!token) return Response.json({ error: 'Microsoft account not connected' }, { status: 404 });

    const accessToken = await getMicrosoftAccessToken(base44, token);
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const profileData = profileRes.ok ? await profileRes.json() : {};
    const accountEmail = token.email || profileData.mail || profileData.userPrincipalName || user.email;
    if (accountEmail !== token.email) {
      await base44.asServiceRole.entities.UserOAuthToken.update(token.id, { email: accountEmail });
    }

    const inboxSettings = await getInboxSettings(base44, user.id);
    const listRes = await fetch('https://graph.microsoft.com/v1.0/me/messages?$top=25&$select=id,conversationId,subject,from,receivedDateTime,bodyPreview,body,categories', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!listRes.ok) return Response.json({ error: await listRes.text() }, { status: 502 });
    const listData = await listRes.json();
    const messages = listData.value || [];
    const processed = [];

    for (const message of messages) {
      const existing = await base44.asServiceRole.entities.EmailThread.filter({ message_id: message.id });
      if (existing.length > 0) continue;

      const fromEmail = message.from?.emailAddress?.address || '';
      const fromName = message.from?.emailAddress?.name || fromEmail;
      const snippet = message.bodyPreview || '';
      const body = htmlToText(message.body?.content || '').slice(0, 5000);
      const category = await categorizeEmail(inboxSettings, fromEmail, message.subject || '', snippet);

      const thread = await base44.asServiceRole.entities.EmailThread.create({
        user_id: user.id,
        provider: 'microsoft',
        account_email: accountEmail,
        thread_id: message.conversationId || message.id,
        message_id: message.id,
        subject: message.subject || 'Senza oggetto',
        from_email: fromEmail,
        from_name: fromName,
        snippet,
        body,
        received_at: message.receivedDateTime,
        category,
        status: 'nuovo',
        labels: message.categories || [],
      });

      if (['da_rispondere', 'contratto'].includes(category) && body) {
        await base44.asServiceRole.functions.invoke('draftGenerator', {
          provider: 'microsoft',
          account_email: accountEmail,
          user_id: user.id,
          thread_id: message.conversationId || message.id,
          message_id: message.id,
          subject: message.subject || 'Senza oggetto',
          from_email: fromEmail,
          body: body.slice(0, 3000),
        });
      }

      processed.push(thread.id);
    }

    return Response.json({ success: true, processed_count: processed.length, processed_ids: processed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});