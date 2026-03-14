import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function getDraftSettings(base44, userId) {
  const settings = await base44.asServiceRole.entities.DraftSettings.filter({ user_id: userId });
  return settings[0] || {
    enable_drafts: true,
    response_style: 'everything',
    enable_followups: true,
    custom_tone_enabled: false,
    custom_tone_text: '',
    include_signature: true,
    default_signature: '',
    font_family: 'Gmail/Outlook default',
    font_size: 0,
    font_color: '#111111',
  };
}

async function getSignature(base44, userId, fromEmail) {
  const signatures = await base44.asServiceRole.entities.AccountSignature.filter({ user_id: userId, email: fromEmail });
  return signatures[0]?.signature_content || '';
}

Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { thread_id, message_id, subject, from_email, body: emailBody } = body;
    if (!thread_id || !emailBody) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const settings = await getDraftSettings(base44, user.id);
    if (!settings.enable_drafts) {
      return Response.json({ skipped: true, reason: 'drafts_disabled' });
    }

    const accountSignature = await getSignature(base44, user.id, user.email);
    const signatureToUse = settings.include_signature ? (accountSignature || settings.default_signature || '') : '';
    const toneInstructions = settings.custom_tone_enabled && settings.custom_tone_text
      ? `Istruzioni personalizzate utente: ${settings.custom_tone_text}`
      : 'Nessuna istruzione personalizzata.';

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `Sei un assistente email professionale italiano.
Scrivi una risposta professionale e concisa a questa email.

Stile risposta utente: ${settings.response_style}
${toneInstructions}
Font preferito: ${settings.font_family}
Dimensione font: ${settings.font_size}
Colore font: ${settings.font_color}
Firma da includere alla fine se appropriato: ${signatureToUse || 'nessuna'}

Da: ${from_email}
Oggetto: ${subject}
Contenuto email:
${emailBody}

Scrivi SOLO il corpo della risposta in italiano, senza oggetto. Se c'è una firma, inseriscila in fondo.` ,
      response_json_schema: {
        type: 'object',
        properties: {
          draft_content: { type: 'string' },
        },
      },
    });

    const draftContent = result?.draft_content;
    if (!draftContent) {
      return Response.json({ error: 'AI generation failed' }, { status: 500 });
    }

    const threads = await base44.asServiceRole.entities.EmailThread.filter({ thread_id });
    const emailThreadEntity = threads[0] || null;

    const draftEntity = await base44.asServiceRole.entities.Draft.create({
      email_thread_id: emailThreadEntity?.id || thread_id,
      thread_id,
      subject: `Re: ${subject}`,
      content: draftContent,
      status: 'generata',
      tone: settings.custom_tone_enabled ? 'personalizzato' : settings.response_style,
    });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('gmail');
    const rawMessage = [
      `To: ${from_email}`,
      `Subject: Re: ${subject}`,
      `In-Reply-To: ${message_id}`,
      `References: ${message_id}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      draftContent,
    ].join('\r\n');

    const encodedMessage = btoa(unescape(encodeURIComponent(rawMessage)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const gmailRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: {
          threadId: thread_id,
          raw: encodedMessage,
        },
      }),
    });

    if (!gmailRes.ok) {
      const gmailError = await gmailRes.text();
      return Response.json({ error: gmailError || 'Gmail draft creation failed' }, { status: 502 });
    }

    const gmailDraft = await gmailRes.json();
    await base44.asServiceRole.entities.Draft.update(draftEntity.id, {
      gmail_draft_id: gmailDraft.id,
      status: 'generata',
    });

    if (emailThreadEntity) {
      await base44.asServiceRole.entities.EmailThread.update(emailThreadEntity.id, {
        status: 'bozza_generata',
        draft_id: draftEntity.id,
        gmail_draft_id: gmailDraft.id,
      });
    }

    return Response.json({
      status: 'ok',
      draft_id: draftEntity.id,
      gmail_draft_id: gmailDraft.id,
      content: draftContent,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});