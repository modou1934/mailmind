import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function buildSlug(email) {
  const base = (email || 'utente').split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'utente';
}

async function ensureProfile(base44, user) {
  const existingProfiles = await base44.entities.SchedulingProfile.filter({ user_id: user.id });
  if (existingProfiles.length > 0) {
    return existingProfiles[0];
  }

  return await base44.entities.SchedulingProfile.create({
    user_id: user.id,
    slug: buildSlug(user.email),
    meeting_duration_minutes: 30,
    timezone: 'Europe/Rome',
    include_link_in_drafts: true,
    generate_drafts_for_proposals: true,
    send_confirmation_emails: true,
    is_active: true,
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const profile = await ensureProfile(base44, user);

    const nextSlug = (payload.slug || profile.slug || buildSlug(user.email)).trim().toLowerCase();
    const slugMatches = await base44.asServiceRole.entities.SchedulingProfile.filter({ slug: nextSlug });
    const slugTakenByOtherUser = slugMatches.some((item) => item.user_id !== user.id);

    if (slugTakenByOtherUser) {
      return Response.json({ error: 'Slug already in use' }, { status: 409 });
    }

    const updatedProfile = await base44.entities.SchedulingProfile.update(profile.id, {
      slug: nextSlug,
      meeting_duration_minutes: payload.meeting_duration_minutes ?? profile.meeting_duration_minutes,
      timezone: payload.timezone ?? profile.timezone,
      include_link_in_drafts: payload.include_link_in_drafts ?? profile.include_link_in_drafts,
      generate_drafts_for_proposals: payload.generate_drafts_for_proposals ?? profile.generate_drafts_for_proposals,
      send_confirmation_emails: payload.send_confirmation_emails ?? profile.send_confirmation_emails,
      is_active: payload.is_active ?? profile.is_active,
    });

    let availability = await base44.entities.SchedulingAvailability.filter({ user_id: user.id });

    if (Array.isArray(payload.availability_blocks)) {
      for (const block of availability) {
        await base44.entities.SchedulingAvailability.delete(block.id);
      }

      availability = payload.availability_blocks.length > 0
        ? await base44.entities.SchedulingAvailability.bulkCreate(
            payload.availability_blocks.map((block) => ({
              user_id: user.id,
              day_of_week: block.day_of_week,
              start_time: block.start_time,
              end_time: block.end_time,
              timezone: block.timezone || updatedProfile.timezone,
              is_active: block.is_active ?? true,
            }))
          )
        : [];
    }

    return Response.json({ profile: updatedProfile, availability });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});