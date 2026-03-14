import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [emails, drafts, meetingNotes, schedulingProfiles, connectedAccounts] = await Promise.all([
      base44.asServiceRole.entities.EmailThread.filter({ created_by: user.email }),
      base44.asServiceRole.entities.Draft.filter({ created_by: user.email }),
      base44.entities.MeetingNote.filter({ user_id: user.id }),
      base44.entities.SchedulingProfile.filter({ user_id: user.id }),
      base44.asServiceRole.entities.UserOAuthToken.filter({ user_id: user.id }),
    ]);

    const totalMeetingSeconds = meetingNotes.reduce((sum, note) => sum + (note.duration_seconds || 0), 0);
    const totalMeetingHours = Math.round((totalMeetingSeconds / 3600) * 10) / 10;
    const schedulingProfile = schedulingProfiles[0] || null;

    return Response.json({
      stats: {
        emails_processed: emails.length,
        drafts_created: drafts.length,
        meeting_hours: totalMeetingHours,
        connected_accounts: connectedAccounts.length,
      },
      scheduling: schedulingProfile ? {
        slug: schedulingProfile.slug,
        url: `/book/${schedulingProfile.slug}`,
      } : null,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});