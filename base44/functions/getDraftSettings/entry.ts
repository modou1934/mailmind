import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await base44.entities.DraftSettings.filter({ user_id: user.id });

    if (existing.length > 0) {
      return Response.json({ settings: existing[0] });
    }

    const created = await base44.entities.DraftSettings.create({
      user_id: user.id,
      enable_drafts: true,
      unused_drafts_days: 14,
      response_style: 'everything',
      enable_followups: true,
      followup_days: 3,
      custom_tone_enabled: false,
      custom_tone_text: '',
      font_family: 'Gmail/Outlook default',
      font_size: 0,
      font_color: '#111111',
      include_signature: true,
      default_signature: '',
    });

    return Response.json({ settings: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});