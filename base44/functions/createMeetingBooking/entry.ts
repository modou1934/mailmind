import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function toMinutes(timeString) {
  const [hours, minutes] = String(timeString).split(':').map(Number);
  return hours * 60 + minutes;
}

function addMinutes(timeString, duration) {
  const total = toMinutes(timeString) + duration;
  const hours = String(Math.floor(total / 60)).padStart(2, '0');
  const minutes = String(total % 60).padStart(2, '0');
  return `${hours}:${minutes}`;
}

function dayLabelToIndex(dateString) {
  const jsDay = new Date(`${dateString}T12:00:00`).getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getIsoDateTime(dateString, timeString) {
  return `${dateString}T${timeString}:00`;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const slug = String(payload.slug || '').trim().toLowerCase();
    const guestName = String(payload.guest_name || '').trim();
    const guestEmail = String(payload.guest_email || '').trim().toLowerCase();
    const scheduledDate = String(payload.scheduled_date || '').trim();
    const startTime = String(payload.start_time || '').trim();
    const notes = String(payload.notes || '').trim();

    if (!slug || !guestName || !guestEmail || !scheduledDate || !startTime) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const profiles = await base44.asServiceRole.entities.SchedulingProfile.filter({ slug });
    const profile = profiles[0];
    if (!profile || profile.is_active === false) {
      return Response.json({ error: 'Scheduling profile not found' }, { status: 404 });
    }

    const availability = await base44.asServiceRole.entities.SchedulingAvailability.filter({ user_id: profile.user_id });
    const dayIndex = dayLabelToIndex(scheduledDate);
    const duration = profile.meeting_duration_minutes || 30;
    const endTime = addMinutes(startTime, duration);
    const matchingBlock = availability.find((block) => block.is_active !== false && block.day_of_week === dayIndex && toMinutes(startTime) >= toMinutes(block.start_time) && toMinutes(endTime) <= toMinutes(block.end_time));

    if (!matchingBlock) {
      return Response.json({ error: 'Selected time is not available' }, { status: 409 });
    }

    const existingBookings = await base44.asServiceRole.entities.MeetingBooking.filter({ owner_user_id: profile.user_id });
    const conflict = existingBookings.find((booking) => booking.status === 'confirmed' && booking.scheduled_date === scheduledDate && booking.start_time === startTime);
    if (conflict) {
      return Response.json({ error: 'Selected time is already booked' }, { status: 409 });
    }

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const eventRes = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        summary: `Riunione con ${guestName}`,
        description: notes || `Prenotazione ricevuta da ${guestEmail}`,
        start: {
          dateTime: getIsoDateTime(scheduledDate, startTime),
          timeZone: profile.timezone,
        },
        end: {
          dateTime: getIsoDateTime(scheduledDate, endTime),
          timeZone: profile.timezone,
        },
        attendees: [{ email: guestEmail, displayName: guestName }],
      }),
    });

    if (!eventRes.ok) {
      return Response.json({ error: await eventRes.text() }, { status: 502 });
    }

    const event = await eventRes.json();

    const booking = await base44.asServiceRole.entities.MeetingBooking.create({
      scheduling_profile_id: profile.id,
      owner_user_id: profile.user_id,
      guest_name: guestName,
      guest_email: guestEmail,
      scheduled_date: scheduledDate,
      start_time: startTime,
      end_time: endTime,
      timezone: profile.timezone,
      meeting_duration_minutes: duration,
      notes,
      google_event_id: event.id,
      status: 'confirmed',
    });

    return Response.json({ booking, calendar_event_id: event.id, calendar_event_link: event.htmlLink || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});