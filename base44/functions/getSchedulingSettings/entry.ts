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

async function ensureAvailability(base44, user) {
  const existingBlocks = await base44.entities.SchedulingAvailability.filter({ user_id: user.id });
  if (existingBlocks.length > 0) {
    return existingBlocks;
  }

  return await base44.entities.SchedulingAvailability.bulkCreate([
    { user_id: user.id, day_of_week: 0, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
    { user_id: user.id, day_of_week: 1, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
    { user_id: user.id, day_of_week: 2, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
    { user_id: user.id, day_of_week: 3, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
    { user_id: user.id, day_of_week: 4, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
  ]);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [profile, availability] = await Promise.all([
      ensureProfile(base44, user),
      ensureAvailability(base44, user),
    ]);

    const sortedAvailability = [...availability].sort((a, b) => {
      if (a.day_of_week !== b.day_of_week) return a.day_of_week - b.day_of_week;
      return a.start_time.localeCompare(b.start_time);
    });

    return Response.json({ profile, availability: sortedAvailability });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});