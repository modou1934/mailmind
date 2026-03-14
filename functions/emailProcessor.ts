import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

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

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    const syncStates = await base44.asServiceRole.entities.SyncState.list();
    const syncRecord = syncStates.length > 0 ? syncStates[0] : null;

    if (!syncRecord) {
      await base44.asServiceRole.entities.SyncState.create({
        history_id: currentHistoryId,
        account_email: decoded.emailAddress || '',
      });
      return Response.json({ status: 'initialized', historyId: currentHistoryId });
    }

    const prevHistoryId = syncRecord.history_id;
    const historyRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/history?startHistoryId=${prevHistoryId}&historyTypes=messageAdded`,
      { headers: authHeader },
    );

    if (historyRes.status === 404) {
      await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
        history_id: currentHistoryId,
        account_email: decoded.emailAddress || syncRecord.account_email || '',
      });
      return Response.json({ status: 'history_reset', historyId: currentHistoryId });
    }

    if (!historyRes.ok) {
      const err = await historyRes.text();
      return Response.json({ status: 'history_error', detail: err }, { status: 500 });
    }

    const historyData = await historyRes.json();
    const histories = historyData.history || [];
    const processedIds = [];

    for (const history of histories) {
      for (const added of history.messagesAdded || []) {
        const msgId = added.message.id;

        const msgRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=full`,
          { headers: authHeader },
        );

        if (!msgRes.ok) {
          continue;
        }

        const msg = await msgRes.json();
        const labelIds = msg.labelIds || [];

        if (labelIds.includes('SENT') || labelIds.includes('DRAFT')) {
          continue;
        }

        const headers = msg.payload?.headers || [];
        const getHeader = (name) => headers.find((header) => header.name.toLowerCase() === name.toLowerCase())?.value || '';

        const subject = getHeader('Subject');
        const from = getHeader('From');
        const fromMatch = from.match(/^(.*?)\s*<(.+)>$/) || [null, from, from];
        const fromName = (fromMatch[1] || '').trim().replace(/^"|"$/g, '');
        const fromEmail = fromMatch[2] || from;
        const receivedAt = new Date(parseInt(msg.internalDate, 10)).toISOString();
        const snippet = msg.snippet || '';

        let bodyText = '';
        const extractText = (part) => {
          if (!part) {
            return;
          }
          if (part.mimeType === 'text/plain' && part.body?.data) {
            bodyText += atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'));
          }
          for (const subPart of part.parts || []) {
            extractText(subPart);
          }
        };
        extractText(msg.payload);

        const categoryResult = await base44.asServiceRole.integrations.Core.InvokeLLM({
          prompt: `Categorizza questa email in italiano. Scegli UNA categoria tra: da_rispondere, marketing, notifica, da_seguire, per_conoscenza, pec, burocrazia, contratto, newsletter, altro.

Mittente: ${fromEmail}
Oggetto: ${subject}
Anteprima: ${snippet}

Rispondi con SOLO il nome della categoria, nessun altro testo.`,
          response_json_schema: {
            type: 'object',
            properties: {
              category: { type: 'string' },
            },
          },
        });

        const category = categoryResult?.category || 'altro';
        const existingThreads = await base44.asServiceRole.entities.EmailThread.filter({ thread_id: msg.threadId });
        const existingThread = existingThreads[0] || null;

        const threadPayload = {
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
          labels: labelIds,
        };

        if (existingThread) {
          await base44.asServiceRole.entities.EmailThread.update(existingThread.id, threadPayload);
        } else {
          await base44.asServiceRole.entities.EmailThread.create(threadPayload);
        }

        const shouldGenerateDraft = ['da_rispondere', 'contratto'].includes(category)
          && bodyText
          && (!existingThread || existingThread.message_id !== msgId || !existingThread.draft_id);

        if (shouldGenerateDraft) {
          await base44.asServiceRole.functions.invoke('draftGenerator', {
            thread_id: msg.threadId,
            message_id: msgId,
            subject,
            from_email: fromEmail,
            body: bodyText.slice(0, 3000),
          });
        }

        processedIds.push(msgId);
      }
    }

    await base44.asServiceRole.entities.SyncState.update(syncRecord.id, {
      history_id: currentHistoryId,
      account_email: decoded.emailAddress || syncRecord.account_email || '',
    });

    return Response.json({ status: 'ok', processed: processedIds.length, message_ids: processedIds });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});