import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

const defaultTopicStates = {
  accounts: true,
  coldOutreach: false,
  comment: true,
  contract: true,
  event: true,
  notetaker: true,
  meeting: true,
  newsletter: true,
  orders: true,
  payment: true,
  promotion: false,
  submission: true,
  toolAlert: true,
  pec: true,
  burocrazia: true,
};

function buildSlug(email) {
  const base = (email || 'utente').split('@')[0].toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return base || 'utente';
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const created = [];
    const emailDomain = user.email?.includes('@') ? user.email.split('@')[1] : '';

    const inboxSettings = await base44.entities.InboxSettings.filter({ user_id: user.id });
    if (inboxSettings.length === 0) {
      await base44.entities.InboxSettings.create({
        user_id: user.id,
        move_notification_out: true,
        move_follow_up_out: true,
        move_marketing_out: true,
        keep_todo_in_inbox: false,
        keep_fyi_in_inbox: false,
        respect_existing_categories: true,
        enable_topic_labels: true,
        enable_categorization: true,
        marketing_filter_mode: 'cold_unknown',
        topic_states: defaultTopicStates,
        alternative_emails: [],
        custom_rules: [],
      });
      created.push('InboxSettings');
    }

    const draftSettings = await base44.entities.DraftSettings.filter({ user_id: user.id });
    if (draftSettings.length === 0) {
      await base44.entities.DraftSettings.create({
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
      created.push('DraftSettings');
    }

    const schedulingProfiles = await base44.entities.SchedulingProfile.filter({ user_id: user.id });
    if (schedulingProfiles.length === 0) {
      await base44.entities.SchedulingProfile.create({
        user_id: user.id,
        slug: buildSlug(user.email),
        meeting_duration_minutes: 30,
        timezone: 'Europe/Rome',
        include_link_in_drafts: true,
        generate_drafts_for_proposals: true,
        send_confirmation_emails: true,
        is_active: true,
      });
      created.push('SchedulingProfile');
    }

    const availability = await base44.entities.SchedulingAvailability.filter({ user_id: user.id });
    if (availability.length === 0) {
      await base44.entities.SchedulingAvailability.bulkCreate([
        { user_id: user.id, day_of_week: 0, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
        { user_id: user.id, day_of_week: 1, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
        { user_id: user.id, day_of_week: 2, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
        { user_id: user.id, day_of_week: 3, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true },
        { user_id: user.id, day_of_week: 4, start_time: '09:00', end_time: '17:00', timezone: 'Europe/Rome', is_active: true }
      ]);
      created.push('SchedulingAvailability');
    }

    const organizationSettings = await base44.entities.OrganizationSettings.filter({ owner_user_id: user.id });
    if (organizationSettings.length === 0) {
      await base44.entities.OrganizationSettings.create({
        owner_user_id: user.id,
        organization_name: user.full_name ? `Studio di ${user.full_name}` : 'Il mio Studio',
        organization_domain: emailDomain,
        auto_add_by_domain: true,
        discoverable: true,
        plan_name: 'pro',
        billing_cycle: 'monthly',
      });
      created.push('OrganizationSettings');
    }

    const onboardingState = await base44.entities.OnboardingState.filter({ user_id: user.id });
    if (onboardingState.length === 0) {
      await base44.entities.OnboardingState.create({
        user_id: user.id,
        current_step: 0,
        completed: false,
        selected_plan: 'none',
        email_connected: false,
        calendar_connected: false,
        inbox_setup_completed: false,
        invited_teammates_count: 0,
      });
      created.push('OnboardingState');
    }

    return Response.json({ success: true, created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});