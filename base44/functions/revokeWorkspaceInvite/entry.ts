import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const inviteId = String(payload.invite_id || '').trim();
    if (!inviteId) return Response.json({ error: 'invite_id required' }, { status: 400 });

    const invites = await base44.asServiceRole.entities.PendingInvite.list();
    const invite = invites.find((item) => item.id === inviteId);
    if (!invite) return Response.json({ error: 'Invite not found' }, { status: 404 });
    if (user.role !== 'admin' && invite.invited_by_user_id !== user.id) return Response.json({ error: 'Forbidden' }, { status: 403 });

    const updated = await base44.asServiceRole.entities.PendingInvite.update(invite.id, { status: 'revoked' });
    return Response.json({ invite: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});