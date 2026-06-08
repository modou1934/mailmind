import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { code, provider, redirect_uri, state } = await req.json();

    let authenticatedUserId = null;

    try {
      const user = await base44.auth.me();
      authenticatedUserId = user?.id || null;
    } catch (_) {
      // Popup callback can still complete using the state value when auth is not available.
    }

    if (authenticatedUserId && state && authenticatedUserId !== state) {
      return Response.json({ error: 'Invalid callback state' }, { status: 403 });
    }

    const targetUserId = authenticatedUserId || state;

    if (!targetUserId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let tokenRes;
    let tokenData;
    let email;
    let accessToken;
    let refreshToken;
    let expiresAt;

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
      if (tokenData.error) {
        return Response.json({ error: tokenData.error_description || tokenData.error }, { status: 400 });
      }

      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
      expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      const profileRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = await profileRes.json();
      email = profile.email;
    } else if (provider === 'microsoft') {
      const msClientId = Deno.env.get('MICROSOFT_CLIENT_ID')?.trim();
      const msClientSecret = Deno.env.get('MICROSOFT_CLIENT_SECRET')?.trim();

      tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: msClientId,
          client_secret: msClientSecret,
          redirect_uri,
          grant_type: 'authorization_code',
          scope: 'openid email offline_access https://graph.microsoft.com/Mail.ReadWrite https://graph.microsoft.com/Mail.Send',
        }),
      });
      tokenData = await tokenRes.json();
      if (tokenData.error) {
        return Response.json({ error: `${tokenData.error}: ${tokenData.error_description}` }, { status: 400 });
      }

      accessToken = tokenData.access_token;
      refreshToken = tokenData.refresh_token;
      expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

      const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const profile = await profileRes.json();
      email = profile.mail || profile.userPrincipalName;
    } else {
      return Response.json({ error: 'Unknown provider' }, { status: 400 });
    }

    if (!email || !accessToken) {
      return Response.json({ error: 'OAuth profile retrieval failed' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.UserOAuthToken.filter({
      user_id: targetUserId,
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
        user_id: targetUserId,
        provider,
        email,
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
      });
    }

    return Response.json({ success: true, email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});