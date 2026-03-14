import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function dayLabelToIndex(dateString) {
  const jsDay = new Date(`${dateString}T12:00:00`).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const slug = String(payload.slug || '').trim().toLowerCase();

    if (!slug) {
      return Response.json({ error: 'slug required' }, { status: 400 });
    }

    const profiles = await base44.asServiceRole.entities.SchedulingProfile.filter({ slug });
    const profile = profiles[0];

    if (!profile || profile.is_active === false) {
      return Response.json({ error: 'Scheduling profile not found' }, { status: 404 });
    }

    const availability = await base44.asServiceRole.entities.SchedulingAvailability.filter({ user_id: profile.user_id });
    const bookings = await base44.asServiceRole.entities.MeetingBooking.filter({ owner_user_id: profile.user_id });

    const requestedDate = payload.date ? String(payload.date) : null;
    const dayIndex = requestedDate ? dayLabelToIndex(requestedDate) : null;

    const slots = requestedDate
      ? availability
          .filter((block) => block.is_active !== false && block.day_of_week === dayIndex)
          .flatMap((block) => {
            const [startHour, startMinute] = block.start_time.split(':').map(Number);
            const [endHour, endMinute] = block.end_time.split(':').map(Number);
            const startTotal = startHour * 60 + startMinute;
            const endTotal = endHour * 60 + endMinute;
            const duration = profile.meeting_duration_minutes || 30;
            const results = [];

            for (let current = startTotal; current + duration <= endTotal; current += duration) {
              const hh = String(Math.floor(current / 60)).padStart(2, '0');
              const mm = String(current % 60).padStart(2, '0');
              const candidate = `${hh}:${mm}`;
              const isBooked = bookings.some((booking) => booking.status === 'confirmed' && booking.scheduled_date === requestedDate && booking.start_time === candidate);
              if (!isBooked) {
                results.push(candidate);
              }
            }

            return results;
          })
      : [];

    return Response.json({
      profile,
      availability,
      slots,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});