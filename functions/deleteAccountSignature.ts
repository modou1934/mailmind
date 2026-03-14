import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const signatureId = String(payload.signature_id || '').trim();
    const email = String(payload.email || '').trim().toLowerCase();

    const signatures = await base44.entities.AccountSignature.filter({ user_id: user.id });
    const target = signatures.find((item) => item.id === signatureId || item.email === email);

    if (!target) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    await base44.entities.AccountSignature.delete(target.id);
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});