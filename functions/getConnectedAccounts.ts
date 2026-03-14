import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user_id } = await req.json();

    let resolvedUserId = user_id || null;

    try {
      const user = await base44.auth.me();
      if (user?.id) {
        resolvedUserId = user.id;
      }
    } catch (_) {
      // In preview the authenticated app user may be unavailable; fall back to the explicit user_id.
    }

    if (!resolvedUserId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const tokens = await base44.asServiceRole.entities.UserOAuthToken.filter({ user_id: resolvedUserId });

    const accounts = tokens.map((token) => ({
      id: token.id,
      provider: token.provider,
      email: token.email,
      connected_at: token.created_date,
    }));

    return Response.json({ accounts });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});