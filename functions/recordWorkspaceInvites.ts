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
    const payload = await req.json();
    const emails = Array.isArray(payload.emails) ? [...new Set(payload.emails.map((email) => email.trim().toLowerCase()).filter(Boolean))] : [];

    if (emails.length === 0) {
      return Response.json({ invites: [] });
    }

    const existing = await base44.asServiceRole.entities.PendingInvite.filter({ organization_owner_user_id: organization.owner_user_id });
    const existingEmails = new Set(existing.filter((item) => item.status === 'pending').map((item) => item.invited_email.toLowerCase()));
    const toCreate = emails.filter((email) => !existingEmails.has(email));

    const invites = toCreate.length > 0
      ? await base44.asServiceRole.entities.PendingInvite.bulkCreate(
          toCreate.map((email) => ({
            invited_email: email,
            role: 'user',
            status: 'pending',
            invited_by_user_id: user.id,
            organization_owner_user_id: organization.owner_user_id,
          }))
        )
      : [];

    return Response.json({ invites });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});