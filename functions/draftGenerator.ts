import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

// Generates an AI draft reply and saves it to Gmail + Draft entity
Deno.serve(async (req) => {
  const body = await req.json();
  const base44 = createClientFromRequest(req);

  const { thread_id, message_id, subject, from_email, body: emailBody } = body;

  if (!thread_id || !emailBody) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 });
  }

  // 1. Generate draft with AI
  const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: `Sei un assistente email professionale italiano. Scrivi una risposta professionale e concisa a questa email.

Da: ${from_email}
Oggetto: ${subject}
Contenuto email:
${emailBody}

Scrivi SOLO il corpo della risposta in italiano, senza oggetto. Tono professionale e cordiale.`,
    response_json_schema: {
      type: 'object',
      properties: { draft_content: { type: 'string' } }
    }
  });

  const draftContent = result?.draft_content;
  if (!draftContent) {
    return Response.json({ error: 'AI generation failed' }, { status: 500 });
  }

  // 2. Find the EmailThread entity
  const threads = await base44.asServiceRole.entities.EmailThread.filter({ thread_id });
  const emailThreadEntity = threads[0];

  // 3. Save Draft entity
  const draftEntity = await base44.asServiceRole.entities.Draft.create({
    email_thread_id: emailThreadEntity?.id || thread_id,
    thread_id,
    subject: `Re: ${subject}`,
    content: draftContent,
    status: 'generata',
    tone: 'professionale'
  });

  // 4. Push draft to Gmail
  const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');

  const rawMessage = [
    `To: ${from_email}`,
    `Subject: Re: ${subject}`,
    `In-Reply-To: ${message_id}`,
    `References: ${message_id}`,
    `Content-Type: text/plain; charset=utf-8`,
    ``,
    draftContent
  ].join('\r\n');

  const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        threadId: thread_id,
        raw: encodedMessage
      }
    })
  });

  if (gmailRes.ok) {
    const gmailDraft = await gmailRes.json();
    // Update draft entity with Gmail draft ID
    await base44.asServiceRole.entities.Draft.update(draftEntity.id, {
      gmail_draft_id: gmailDraft.id,
      status: 'generata'
    });
    // Update EmailThread status
    if (emailThreadEntity) {
      await base44.asServiceRole.entities.EmailThread.update(emailThreadEntity.id, {
        status: 'bozza_generata',
        draft_id: draftEntity.id,
        gmail_draft_id: gmailDraft.id
      });
    }
  }

  return Response.json({ status: 'ok', draft_id: draftEntity.id, content: draftContent });
});