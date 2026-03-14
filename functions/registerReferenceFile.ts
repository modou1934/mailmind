import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const fileUrl = String(payload.file_url || '').trim();
    const fileName = String(payload.file_name || '').trim();

    if (!fileUrl || !fileName) {
      return Response.json({ error: 'file_url and file_name are required' }, { status: 400 });
    }

    const created = await base44.entities.ReferenceFile.create({
      user_id: user.id,
      file_name: fileName,
      file_url: fileUrl,
      file_type: payload.file_type || '',
      size_bytes: payload.size_bytes || 0,
      status: 'ready',
    });

    return Response.json({ file: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});