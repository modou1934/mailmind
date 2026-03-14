import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';
import OpenAI from 'npm:openai@4.104.0';

const llmClient = new OpenAI({
  baseURL: 'https://integrate.api.nvidia.com/v1',
  apiKey: Deno.env.get('NVIDIA_API_KEY'),
});

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
    const conversationHistory = orderedMessages.map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content,
    }));

    const workspaceContext = `EMAIL RECENTI:\n${summarizeEmails(emails)}\n\nBOZZE RECENTI:\n${summarizeDrafts(drafts)}\n\nNOTE RIUNIONE RECENTI:\n${summarizeMeetingNotes(meetingNotes)}\n\nSCHEDULING:\n${summarizeScheduling(schedulingProfiles[0] || null)}`;

    const completion = await withRetry(() => llmClient.chat.completions.create({
      model: 'minimaxai/minimax-m2.1',
      messages: [
        {
          role: 'system',
          content: `Sei MailMind AI, un assistente workspace per email, bozze, riunioni e pianificazione. Rispondi sempre in italiano in modo utile e concreto. Usa solo il contesto disponibile. Se il dato non è presente, dillo chiaramente senza inventare.\n\nCONTESTO WORKSPACE:\n${workspaceContext}`,
        },
        ...conversationHistory,
      ],
      temperature: 0.4,
      top_p: 0.95,
      max_tokens: 1200,
    }));

    const rawReply = completion.choices?.[0]?.message?.content?.trim() || 'Non ho trovato abbastanza informazioni per rispondere.';
    const reply = rawReply.replace(/<think>[\s\S]*?<\/think>/gi, '').trim() || 'Non ho trovato abbastanza informazioni per rispondere.';

    const assistantMessage = await base44.entities.ChatMessage.create({
      conversation_id: conversation.id,
      user_id: user.id,
      role: 'assistant',
      content: reply,
    });

    const updatedConversation = await base44.entities.ChatConversation.update(conversation.id, {
      title: conversation.title || buildTitle(message),
      last_message_at: new Date().toISOString(),
    });

    return Response.json({
      conversation: updatedConversation,
      user_message: userMessage,
      assistant_message: assistantMessage,
      reply,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});