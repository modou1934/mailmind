import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function callGenerateContent(model, prompt) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0,
        topP: 0.95,
        maxOutputTokens: 80,
      },
    }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function callEmbedContent(model, content) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:embedContent?key=${Deno.env.get('GEMINI_API_KEY')}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      content: {
        parts: [{ text: content }],
      },
    }),
  });

  const text = await response.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const flashModel = 'gemini-3-flash-preview';
    const embeddingModel = 'gemini-embedding-2-preview';

    const [flashCheck, embeddingCheck] = await Promise.all([
      callGenerateContent(flashModel, 'Rispondi solo con: OK'),
      callEmbedContent(embeddingModel, 'test embedding'),
    ]);

    return Response.json({
      gemini_api_key_present: Boolean(Deno.env.get('GEMINI_API_KEY')),
      checks: {
        [flashModel]: {
          reachable: flashCheck.ok,
          status: flashCheck.status,
          sample: flashCheck.ok
            ? (flashCheck.data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || null)
            : flashCheck.data,
        },
        [embeddingModel]: {
          reachable: embeddingCheck.ok,
          status: embeddingCheck.status,
          sample: embeddingCheck.ok
            ? {
                vector_length: embeddingCheck.data?.embedding?.values?.length || 0,
              }
            : embeddingCheck.data,
        },
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});