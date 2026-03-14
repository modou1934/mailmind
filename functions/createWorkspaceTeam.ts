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
    if (organization.owner_user_id !== user.id && user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const payload = await req.json();
    const teamName = (payload.name || '').trim();
    if (!teamName) {
      return Response.json({ error: 'Team name required' }, { status: 400 });
    }

    const team = await base44.asServiceRole.entities.Team.create({
      owner_user_id: organization.owner_user_id,
      name: teamName,
      description: payload.description || '',
    });

    const memberIds = Array.isArray(payload.member_user_ids) ? [...new Set(payload.member_user_ids)] : [];
    if (memberIds.length > 0) {
      await base44.asServiceRole.entities.TeamMembership.bulkCreate(
        memberIds.map((userId) => ({ team_id: team.id, user_id: userId }))
      );
    }

    return Response.json({ team });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});