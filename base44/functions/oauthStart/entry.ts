import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { provider, redirect_uri, user_id } = await req.json();

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

    if (!redirect_uri) {
      return Response.json({ error: 'redirect_uri required' }, { status: 400 });
    }

    if (provider === 'google') {
      const params = new URLSearchParams({
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')?.trim(),
        redirect_uri,
        response_type: 'code',
        scope: 'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
        access_type: 'offline',
        prompt: 'consent',
        state: resolvedUserId,
      });

      return Response.json({
        url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      });
    }

    if (provider === 'microsoft') {
      const params = new URLSearchParams({
        client_id: Deno.env.get('MICROSOFT_CLIENT_ID')?.trim(),
        redirect_uri,
        response_type: 'code',
        scope: 'openid email offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send',
        state: resolvedUserId,
      });

      return Response.json({
        url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`,
      });
    }

    return Response.json({ error: 'Unknown provider' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});