import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const fileId = String(payload.file_id || '').trim();

    if (!fileId) {
      return Response.json({ error: 'file_id required' }, { status: 400 });
    }

    const existing = await base44.entities.ReferenceFile.filter({ user_id: user.id });
    const file = existing.find((item) => item.id === fileId);

    if (!file) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    await base44.entities.ReferenceFile.delete(fileId);

    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});