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

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const existing = await base44.entities.InboxSettings.filter({ user_id: user.id });

    if (existing.length > 0) {
      return Response.json({ settings: existing[0] });
    }

    const created = await base44.entities.InboxSettings.create({
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

    return Response.json({ settings: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});