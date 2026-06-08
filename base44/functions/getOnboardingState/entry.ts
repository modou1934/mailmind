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

    const [state, tokens, invites] = await Promise.all([
      ensureOnboardingState(base44, user),
      base44.asServiceRole.entities.UserOAuthToken.filter({ user_id: user.id }),
      base44.asServiceRole.entities.PendingInvite.filter({ invited_by_user_id: user.id }),
    ]);

    const emailConnected = tokens.some((token) => token.email);
    const pendingInviteCount = invites.filter((invite) => invite.status === 'pending').length;

    return Response.json({
      onboarding_state: {
        ...state,
        email_connected: state.email_connected || emailConnected,
        invited_teammates_count: Math.max(state.invited_teammates_count || 0, pendingInviteCount),
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});