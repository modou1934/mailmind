import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const GEMINI_MODEL = 'gemini-3.1-pro-preview';

async function callGemini(prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.3,
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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const fileUrl = String(payload.file_url || '').trim();
    const title = String(payload.title || '').trim() || 'Riunione senza titolo';

    if (!fileUrl) {
      return Response.json({ error: 'file_url required' }, { status: 400 });
    }

    const meetingNote = await base44.entities.MeetingNote.create({
      user_id: user.id,
      title,
      source_type: 'uploaded_audio',
      file_url: fileUrl,
      status: 'transcribing',
    });

    const transcriptionRes = await fetch('https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&diarize=true', {
      method: 'POST',
      headers: {
        Authorization: `Token ${Deno.env.get('DEEPGRAM_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: fileUrl }),
    });

    if (!transcriptionRes.ok) {
      const transcriptionError = await transcriptionRes.text();
      await base44.entities.MeetingNote.update(meetingNote.id, { status: 'failed' });
      return Response.json({ error: transcriptionError }, { status: 502 });
    }

    const transcriptionData = await transcriptionRes.json();
    const transcript = transcriptionData.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
    const durationSeconds = Math.round(transcriptionData.metadata?.duration || 0);

    const summaryPrompt = `Leggi questa trascrizione di riunione in italiano e restituisci un JSON valido con questo formato esatto:
{
  "summary": "riassunto breve ma utile",
  "action_items": ["azione 1", "azione 2"]
}

Trascrizione:
${transcript}`;

    const summaryRaw = await callGemini(summaryPrompt);
    let summary = 'Nessun riassunto disponibile';
    let actionItems = [];

    try {
      const parsed = JSON.parse(summaryRaw.replace(/```json|```/g, '').trim());
      summary = parsed.summary || summary;
      actionItems = Array.isArray(parsed.action_items) ? parsed.action_items : [];
    } catch (_) {
      summary = summaryRaw || summary;
    }

    const updated = await base44.entities.MeetingNote.update(meetingNote.id, {
      transcript,
      summary,
      action_items: actionItems,
      duration_seconds: durationSeconds,
      status: 'ready',
    });

    return Response.json({ meeting_note: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});