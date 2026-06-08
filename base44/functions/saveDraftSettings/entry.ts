import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const settings = await base44.entities.DraftSettings.filter({ user_id: user.id });
    const existing = settings[0] || await base44.entities.DraftSettings.create({
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

    const updateData = {
      enable_drafts: payload.enable_drafts ?? existing.enable_drafts,
      unused_drafts_days: payload.unused_drafts_days ?? existing.unused_drafts_days,
      response_style: payload.response_style ?? existing.response_style,
      enable_followups: payload.enable_followups ?? existing.enable_followups,
      followup_days: payload.followup_days ?? existing.followup_days,
      custom_tone_enabled: payload.custom_tone_enabled ?? existing.custom_tone_enabled,
      custom_tone_text: payload.custom_tone_text ?? existing.custom_tone_text,
      font_family: payload.font_family ?? existing.font_family,
      font_size: payload.font_size ?? existing.font_size,
      font_color: payload.font_color ?? existing.font_color,
      include_signature: payload.include_signature ?? existing.include_signature,
      default_signature: payload.default_signature ?? existing.default_signature,
    };

    const updated = await base44.entities.DraftSettings.update(existing.id, updateData);

    return Response.json({ settings: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});