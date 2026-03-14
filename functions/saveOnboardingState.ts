import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

async function ensureOnboardingState(base44, user) {
  const existing = await base44.entities.OnboardingState.filter({ user_id: user.id });
  if (existing.length > 0) {
    return existing[0];
  }

  return await base44.entities.OnboardingState.create({
    user_id: user.id,
    current_step: 0,
    completed: false,
    selected_plan: 'none',
    email_connected: false,
    calendar_connected: false,
    inbox_setup_completed: false,
    invited_teammates_count: 0,
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
    const state = await ensureOnboardingState(base44, user);

    const updated = await base44.entities.OnboardingState.update(state.id, {
      current_step: payload.current_step ?? state.current_step,
      completed: payload.completed ?? state.completed,
      selected_plan: payload.selected_plan ?? state.selected_plan,
      email_connected: payload.email_connected ?? state.email_connected,
      calendar_connected: payload.calendar_connected ?? state.calendar_connected,
      inbox_setup_completed: payload.inbox_setup_completed ?? state.inbox_setup_completed,
      invited_teammates_count: payload.invited_teammates_count ?? state.invited_teammates_count,
    });

    return Response.json({ onboarding_state: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});