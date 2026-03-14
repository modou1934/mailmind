import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await base44.functions.invoke('ensureWorkspaceDefaults', {});

    const settings = await base44.entities.InboxSettings.filter({ user_id: user.id });

    return Response.json({ settings: settings[0] || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});