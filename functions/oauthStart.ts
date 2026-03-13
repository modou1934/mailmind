import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  const { provider, redirect_uri } = await req.json();

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID'),
      redirect_uri,
      response_type: 'code',
      scope: 'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
      access_type: 'offline',
      prompt: 'consent',
      state: user.id,
    });
    return Response.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  }

  if (provider === 'microsoft') {
    const params = new URLSearchParams({
      client_id: Deno.env.get('MICROSOFT_CLIENT_ID'),
      redirect_uri,
      response_type: 'code',
      scope: 'openid email offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send',
      state: user.id,
    });
    return Response.json({ url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}` });
  }

  return Response.json({ error: 'Unknown provider' }, { status: 400 });
});