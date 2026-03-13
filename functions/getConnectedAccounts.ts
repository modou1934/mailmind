import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const tokens = await base44.asServiceRole.entities.UserOAuthToken.filter({ user_id: user.id });

  const accounts = tokens.map(t => ({
    id: t.id,
    provider: t.provider,
    email: t.email,
    connected_at: t.created_date,
  }));

  return Response.json({ accounts });
});