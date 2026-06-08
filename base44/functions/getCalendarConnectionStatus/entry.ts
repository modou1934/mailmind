import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const connection = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    return Response.json({ connected: Boolean(connection?.accessToken) });
  } catch (_) {
    return Response.json({ connected: false });
  }
});