import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { token_id, user_id } = await req.json();

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

    if (!token_id) {
      return Response.json({ error: 'token_id required' }, { status: 400 });
    }

    const tokens = await base44.asServiceRole.entities.UserOAuthToken.filter({ user_id: resolvedUserId });
    const token = tokens.find((item) => item.id === token_id);

    if (!token) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    await base44.asServiceRole.entities.UserOAuthToken.delete(token_id);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});