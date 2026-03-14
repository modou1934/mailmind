import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await base44.functions.invoke('ensureWorkspaceDefaults', {});

    const payload = await req.json();
    const settings = await base44.entities.InboxSettings.filter({ user_id: user.id });
    const existing = settings[0];

    if (!existing) {
      return Response.json({ error: 'Inbox settings not found' }, { status: 404 });
    }

    const updateData = {
      move_notification_out: payload.move_notification_out ?? existing.move_notification_out,
      move_follow_up_out: payload.move_follow_up_out ?? existing.move_follow_up_out,
      move_marketing_out: payload.move_marketing_out ?? existing.move_marketing_out,
      keep_todo_in_inbox: payload.keep_todo_in_inbox ?? existing.keep_todo_in_inbox,
      keep_fyi_in_inbox: payload.keep_fyi_in_inbox ?? existing.keep_fyi_in_inbox,
      respect_existing_categories: payload.respect_existing_categories ?? existing.respect_existing_categories,
      enable_topic_labels: payload.enable_topic_labels ?? existing.enable_topic_labels,
      enable_categorization: payload.enable_categorization ?? existing.enable_categorization,
      marketing_filter_mode: payload.marketing_filter_mode ?? existing.marketing_filter_mode,
      topic_states: payload.topic_states ?? existing.topic_states,
      alternative_emails: payload.alternative_emails ?? existing.alternative_emails,
      custom_rules: payload.custom_rules ?? existing.custom_rules,
    };

    const updated = await base44.entities.InboxSettings.update(existing.id, updateData);

    return Response.json({ settings: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});