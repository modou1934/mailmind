import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const email = String(payload.email || '').trim().toLowerCase();
    const signatureContent = String(payload.signature_content || '');

    if (!email) {
      return Response.json({ error: 'Email required' }, { status: 400 });
    }

    const existing = await base44.entities.AccountSignature.filter({ user_id: user.id, email });

    if (existing.length > 0) {
      const updated = await base44.entities.AccountSignature.update(existing[0].id, {
        signature_content: signatureContent,
      });
      return Response.json({ signature: updated });
    }

    const created = await base44.entities.AccountSignature.create({
      user_id: user.id,
      email,
      signature_content: signatureContent,
    });

    return Response.json({ signature: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});