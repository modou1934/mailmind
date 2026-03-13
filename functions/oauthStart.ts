import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const { provider, redirect_uri, user_id } = await req.json();

  if (!user_id) return Response.json({ error: 'user_id required' }, { status: 400 });

  if (provider === 'google') {
    const params = new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID')?.trim(),
      redirect_uri,
      response_type: 'code',
      scope: 'openid email https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.compose https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.send',
      access_type: 'offline',
      prompt: 'consent',
      state: user_id,
    });
    return Response.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params}` });
  }

  if (provider === 'microsoft') {
    const params = new URLSearchParams({
      client_id: Deno.env.get('MICROSOFT_CLIENT_ID')?.trim(),
      redirect_uri,
      response_type: 'code',
      scope: 'openid email offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send',
      state: user_id,
    });
    return Response.json({ url: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}` });
  }

  return Response.json({ error: 'Unknown provider' }, { status: 400 });
});