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
    const isOwner = organization.owner_user_id === user.id;

    return Response.json({ organization, is_owner: isOwner });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});