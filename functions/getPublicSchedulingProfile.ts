import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function dayLabelToIndex(dateString) {
  const jsDay = new Date(`${dateString}T12:00:00`).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function toMinutes(timeString) {
  const [hours, minutes] = String(timeString).split(':').map(Number);
  return hours * 60 + minutes;
}

function getDateRange(dateString) {
  return {
    timeMin: `${dateString}T00:00:00`,
    timeMax: `${dateString}T23:59:59`,
  };
}

function extractBusyRanges(events = []) {
  return events.flatMap((event) => {
    const start = event.start?.dateTime;
    const end = event.end?.dateTime;
    if (!start || !end) return [];
    const startDate = new Date(start);
    const endDate = new Date(end);
    const startMinutes = startDate.getHours() * 60 + startDate.getMinutes();
    const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
    return [{ startMinutes, endMinutes }];
  });
}

function overlapsBusyRange(startMinutes, endMinutes, busyRanges) {
  return busyRanges.some((range) => startMinutes < range.endMinutes && endMinutes > range.startMinutes);
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
    let busyRanges = [];

    if (requestedDate) {
      try {
        const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
        const { timeMin, timeMax } = getDateRange(requestedDate);
        const calendarRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (calendarRes.ok) {
          const calendarData = await calendarRes.json();
          busyRanges = extractBusyRanges(calendarData.items || []);
        }
      } catch (_) {
        busyRanges = [];
      }
    }

    const slots = requestedDate
      ? availability
          .filter((block) => block.is_active !== false && block.day_of_week === dayIndex)
          .flatMap((block) => {
            const startTotal = toMinutes(block.start_time);
            const endTotal = toMinutes(block.end_time);
            const duration = profile.meeting_duration_minutes || 30;
            const results = [];

            for (let current = startTotal; current + duration <= endTotal; current += duration) {
              const hh = String(Math.floor(current / 60)).padStart(2, '0');
              const mm = String(current % 60).padStart(2, '0');
              const candidate = `${hh}:${mm}`;
              const candidateEnd = current + duration;
              const isBooked = bookings.some((booking) => booking.status === 'confirmed' && booking.scheduled_date === requestedDate && booking.start_time === candidate);
              const isCalendarBusy = overlapsBusyRange(current, candidateEnd, busyRanges);
              if (!isBooked && !isCalendarBusy) {
                results.push(candidate);
              }
            }

            return results;
          })
      : [];

    return Response.json({ profile, availability, slots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});