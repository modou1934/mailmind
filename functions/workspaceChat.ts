import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GEMINI_MODEL = 'gemini-3-flash-preview';

async function callGemini(prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        topP: 0.95,
        maxOutputTokens: 1200,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(operation, attempts = 3) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(300 * attempt);
      }
    }
  }
  throw lastError;
}

function buildTitle(message) {
  const cleaned = String(message || '').trim().replace(/\s+/g, ' ');
  if (!cleaned) return 'Nuova chat';
  return cleaned.slice(0, 60);
}

function summarizeEmails(emails) {
  if (!emails.length) return '- Nessuna email recente';
  return emails.map((email) => `- [${email.category || 'altro'}] ${email.subject || 'Senza oggetto'} · da ${email.from_email || 'mittente sconosciuto'} · ${email.snippet || ''}`).join('\n');
}

function summarizeDrafts(drafts) {
  if (!drafts.length) return '- Nessuna bozza recente';
  return drafts.map((draft) => `- ${draft.subject || 'Bozza senza oggetto'} · stato ${draft.status || 'generata'} · ${String(draft.content || '').slice(0, 180)}`).join('\n');
}

function summarizeMeetingNotes(notes) {
  if (!notes.length) return '- Nessuna nota riunione recente';
  return notes.map((note) => `- ${note.title || 'Riunione'} · ${note.summary || 'Nessun riassunto disponibile'} · azioni: ${(note.action_items || []).join(', ') || 'nessuna'}`).join('\n');
}

function summarizeScheduling(profile) {
  if (!profile) return '- Nessun profilo scheduling configurato';
  return `- Link: mailmind.ai/e/${profile.slug}/${profile.meeting_duration_minutes} · timezone ${profile.timezone}`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const message = String(payload.message || '').trim();
    if (!message) {
      return Response.json({ error: 'Message required' }, { status: 400 });
    }

    let conversation = null;
    if (payload.conversation_id) {
      const existing = await base44.asServiceRole.entities.ChatConversation.filter({ id: payload.conversation_id, user_id: user.id });
      conversation = existing[0] || null;
    }

    if (!conversation) {
      conversation = await base44.entities.ChatConversation.create({
        user_id: user.id,
        title: buildTitle(message),
        context_type: 'workspace',
        last_message_at: new Date().toISOString(),
      });
    }

    const userMessage = await base44.entities.ChatMessage.create({
      conversation_id: conversation.id,
      user_id: user.id,
      role: 'user',
      content: message,
    });

    const [messages, emails, drafts, meetingNotes, schedulingProfiles] = await Promise.all([
      base44.asServiceRole.entities.ChatMessage.filter({ conversation_id: conversation.id, user_id: user.id }, '-created_date', 12),
      base44.asServiceRole.entities.EmailThread.filter({ created_by: user.email }, '-received_at', 8),
      base44.asServiceRole.entities.Draft.filter({ created_by: user.email }, '-updated_date', 8),
      base44.entities.MeetingNote.filter({ user_id: user.id }, '-updated_date', 5),
      base44.entities.SchedulingProfile.filter({ user_id: user.id }),
    ]);

    const orderedMessages = [...messages].reverse();
    const conversationHistory = orderedMessages.map((item) => `${item.role === 'assistant' ? 'Assistente' : 'Utente'}: ${item.content}`).join('\n');

    const workspaceContext = `EMAIL RECENTI:\n${summarizeEmails(emails)}\n\nBOZZE RECENTI:\n${summarizeDrafts(drafts)}\n\nNOTE RIUNIONE RECENTI:\n${summarizeMeetingNotes(meetingNotes)}\n\nSCHEDULING:\n${summarizeScheduling(schedulingProfiles[0] || null)}`;

    const prompt = `Sei MailMind AI, un assistente workspace per email, bozze, riunioni e pianificazione. Rispondi sempre in italiano in modo utile e concreto. Usa solo il contesto disponibile. Se il dato non è presente, dillo chiaramente senza inventare.\n\nCONTESTO WORKSPACE:\n${workspaceContext}\n\nCRONOLOGIA CONVERSAZIONE:\n${conversationHistory}`;

    const reply = await withRetry(() => callGemini(`${prompt}\n\nDOMANDA UTENTE:\n${message}`));
    const cleanedReply = reply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || 'Non ho trovato abbastanza informazioni per rispondere.';

    const assistantMessage = await base44.entities.ChatMessage.create({
      conversation_id: conversation.id,
      user_id: user.id,
      role: 'assistant',
      content: cleanedReply,
    });

    const updatedConversation = await base44.entities.ChatConversation.update(conversation.id, {
      title: conversation.title || buildTitle(message),
      last_message_at: new Date().toISOString(),
    });

    return Response.json({
      conversation: updatedConversation,
      user_message: userMessage,
      assistant_message: assistantMessage,
      reply: cleanedReply,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});