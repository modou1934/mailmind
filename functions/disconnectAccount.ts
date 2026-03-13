import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { token_id } = await req.json();

  // Ensure the token belongs to this user
  const tokens = await base44.asServiceRole.entities.UserOAuthToken.filter({ user_id: user.id });
  const token = tokens.find(t => t.id === token_id);
  if (!token) return Response.json({ error: 'Not found' }, { status: 404 });

  await base44.asServiceRole.entities.UserOAuthToken.delete(token_id);

  return Response.json({ success: true });
});