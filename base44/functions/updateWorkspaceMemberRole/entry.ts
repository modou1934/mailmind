import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json();
    const memberId = String(payload.member_id || '').trim();
    const role = payload.role === 'admin' ? 'admin' : 'user';
    if (!memberId) return Response.json({ error: 'member_id required' }, { status: 400 });

    const updated = await base44.asServiceRole.entities.User.update(memberId, { role });
    return Response.json({ member: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});