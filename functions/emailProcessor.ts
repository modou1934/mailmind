import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Called by Base44 connector automation on Gmail mailbox changes
Deno.serve(async (req) => {
  const body = await req.json();
  const base44 = createClientFromRequest(req);

  // 1. Decode Pub/Sub notification from Gmail
  const decoded = JSON.parse(atob(body.data.message.data));
  const currentHistoryId = String(decoded.historyId);

  // 2. Get Gmail access token
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
  const authHeader = { Authorization: `Bearer ${accessToken}` };

  // 3. Load previous historyId from SyncState entity
  const syncStates = await base44.asServiceRole.entities.SyncState.list();
  const syncRecord = syncStates.length > 0 ? syncStates[0] : null;

  if (!syncRecord) {
    // First run: save baseline historyId, skip processing
    await base44.asServiceRole.entities.SyncState.create({
      history_id: currentHistoryId,
      account_email: decoded.emailAddress || ''
    });
    return Response.json({ status: 'initialized', historyId: currentHistoryId });
  }

  const prevHistoryId = syncRecord.history_id;

  // 4. Fetch new messages since last historyId
  const historyRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${prevHistoryId}&historyTypes=messageAdded`,
    { headers: authHeader }
  );

  if (!historyRes.ok) {
    const err = await historyRes.text();
    return Response.json({ status: 'history_error', detail: err }, { status: 500 });
  }

  const historyData = await historyRes.json();
  const histories = historyData.history || [];

  const processedIds = [];

  for (const history of histories) {
    for (const added of (history.messagesAdded || [])) {
      const msgId = added.message.id;

      // 5. Fetch full message
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
        { headers: authHeader }
      );
      if (!msgRes.ok) continue;

      const msg = await msgRes.json();

      // Skip drafts/sent
      const labelIds = msg.labelIds || [];
      if (labelIds.includes('SENT') || labelIds.includes('DRAFT')) continue;

      // 6. Parse headers
      const headers = msg.payload?.headers || [];
      const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';

      const subject = getHeader('Subject');
      const from = getHeader('From');
      const fromMatch = from.match(/^(.*?)\s*<(.+)>$/) || [null, from, from];
      const fromName = (fromMatch[1] || '').trim().replace(/^"|"$/g, '');
      const fromEmail = fromMatch[2] || from;
      const receivedAt = new Date(parseInt(msg.internalDate)).toISOString();
      const snippet = msg.snippet || '';

      // 7. Extract body text
      let bodyText = '';
      const extractText = (part) => {
        if (!part) return;
        if (part.mimeType === 'text/plain' && part.body?.data) {
          bodyText += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
        }
        for (const sub of (part.parts || [])) extractText(sub);
      };
      extractText(msg.payload);

      // 8. AI categorization
      const categoryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
        prompt: `Categorizza questa email in italiano. Scegli UNA categoria tra: da_rispondere, marketing, notifica, da_seguire, per_conoscenza, pec, burocrazia, contratto, newsletter, altro.

Mittente: ${fromEmail}
Oggetto: ${subject}
Anteprima: ${snippet}

Rispondi con SOLO il nome della categoria, nessun altro testo.`,
        response_json_schema: {
          type: 'object',
          properties: { category: { type: 'string' } }
        }
      });

      const category = categoryResult?.category || 'altro';

      // 9. Save EmailThread entity
      const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({ thread_id: msg.threadId });
      if (existingThreads.length === 0) {
        await base44.asServiceRole.entities.EmailThread.create({
          thread_id: msg.threadId,
          message_id: msgId,
          subject,
          from_email: fromEmail,
          from_name: fromName,
          snippet,
          body: bodyText.slice(0, 5000),
          received_at: receivedAt,
          category,
          status: 'nuovo',
          labels: labelIds
        });
      }

      // 10. Auto-generate draft if category requires a reply
      if (['da_rispondere', 'contratto'].includes(category) && bodyText) {
        await base44.asServiceRole.functions.invoke('draftGenerator', {
          thread_id: msg.threadId,
          message_id: msgId,
          subject,
          from_email: fromEmail,
          body: bodyText.slice(0, 3000)
        });
      }

      processedIds.push(msgId);
    }
  }

  // 11. Update stored historyId
  await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
    history_id: currentHistoryId
  });

  return Response.json({ status: 'ok', processed: processedIds.length });
});