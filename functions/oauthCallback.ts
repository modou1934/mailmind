import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { code, provider, redirect_uri, state: userId } = await req.json();

  let tokenRes, tokenData, email, accessToken, refreshToken, expiresAt;

  if (provider === 'google') {
    tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('GOOGLE_CLIENT_ID')?.trim(),
        client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')?.trim(),
        redirect_uri,
        grant_type: 'authorization_code',
      }),
    });
    tokenData = await tokenRes.json();
    if (tokenData.error) return Response.json({ error: tokenData.error_description }, { status: 400 });

    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Get user email
    const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = await profileRes.json();
    email = profile.email;
  }

  if (provider === 'microsoft') {
    tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: Deno.env.get('MICROSOFT_CLIENT_ID')?.trim(),
        client_secret: Deno.env.get('MICROSOFT_CLIENT_SECRET')?.trim(),
        redirect_uri,
        grant_type: 'authorization_code',
        scope: 'openid email offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send',
      }),
    });
    tokenData = await tokenRes.json();
    if (tokenData.error) return Response.json({ error: tokenData.error_description }, { status: 400 });

    accessToken = tokenData.access_token;
    refreshToken = tokenData.refresh_token;
    expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const profile = await profileRes.json();
    email = profile.mail || profile.userPrincipalName;
  }

  // Check if token already exists for this user+provider+email
  const existing = await base44.asServiceRole.entities.UserOAuthToken.filter({
    user_id: userId,
    provider,
    email,
  });

  if (existing.length > 0) {
    await base44.asServiceRole.entities.UserOAuthToken.update(existing[0].id, {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });
  } else {
    await base44.asServiceRole.entities.UserOAuthToken.create({
      user_id: userId,
      provider,
      email,
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt,
    });
  }

  return Response.json({ success: true, email });
});