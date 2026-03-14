import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function getEmailDomain(email) {
  return email?.includes('@') ? email.split('@')[1].toLowerCase() : '';
}

async function resolveOrganization(base44, user) {
  const own = await base44.entities.OrganizationSettings.filter({ owner_user_id: user.id });
  if (own.length > 0) {
    return own[0];
  }

  const domain = getEmailDomain(user.email);
  if (domain) {
    const domainMatches = await base44.asServiceRole.entities.OrganizationSettings.filter({ organization_domain: domain });
    const autoJoinable = domainMatches.find((item) => item.auto_add_by_domain);
    if (autoJoinable) {
      return autoJoinable;
    }
  }

  return await base44.entities.OrganizationSettings.create({
    owner_user_id: user.id,
    organization_name: user.full_name ? `Studio di ${user.full_name}` : 'Il mio Studio',
    organization_domain: domain,
    auto_add_by_domain: true,
    discoverable: true,
    plan_name: 'pro',
    billing_cycle: 'monthly',
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organization = await resolveOrganization(base44, user);
    const workspaceDomain = (organization.organization_domain || '').toLowerCase();
    const allUsers = await base44.asServiceRole.entities.User.list();
    const members = allUsers
      .filter((item) => workspaceDomain && getEmailDomain(item.email) === workspaceDomain)
      .map((item) => ({
        id: item.id,
        full_name: item.full_name || item.email,
        email: item.email,
        role: item.role || 'user',
        is_owner: item.id === organization.owner_user_id,
      }));

    const teams = await base44.asServiceRole.entities.Team.filter({ owner_user_id: organization.owner_user_id });
    const memberships = await base44.asServiceRole.entities.TeamMembership.list();
    const teamMemberships = memberships.filter((membership) => teams.some((team) => team.id === membership.team_id));
    const invites = await base44.asServiceRole.entities.PendingInvite.filter({ organization_owner_user_id: organization.owner_user_id });

    const enrichedTeams = teams.map((team) => {
      const memberIds = teamMemberships.filter((membership) => membership.team_id === team.id).map((membership) => membership.user_id);
      const teamMembers = members.filter((member) => memberIds.includes(member.id));
      return {
        ...team,
        member_ids: memberIds,
        member_count: teamMembers.length,
        member_names: teamMembers.map((member) => member.full_name),
      };
    });

    return Response.json({
      organization,
      is_owner: organization.owner_user_id === user.id,
      members,
      teams: enrichedTeams,
      invites,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});