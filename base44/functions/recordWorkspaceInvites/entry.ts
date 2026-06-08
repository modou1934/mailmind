import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

function getEmailDomain(email) {
  return email?.includes('@') ? email.split('@')[1].toLowerCase() : '';
}

async function resolveOrganization(base44, user) {
  const own = await base44.entities.OrganizationSettings.filter({ owner_user_id: user.id });
  if (own.length > 0) return own[0];

  const domain = getEmailDomain(user.email);
  if (domain) {
    const domainMatches = await base44.asServiceRole.entities.OrganizationSettings.filter({ organization_domain: domain });
    const autoJoinable = domainMatches.find((item) => item.auto_add_by_domain);
    if (autoJoinable) return autoJoinable;
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

function normalizeInvites(payload) {
  if (Array.isArray(payload.invites)) {
    return payload.invites
      .map((invite) => ({ email: String(invite.email || '').trim().toLowerCase(), role: invite.role === 'admin' ? 'admin' : 'user' }))
      .filter((invite) => invite.email);
  }
  if (Array.isArray(payload.emails)) {
    return [...new Set(payload.emails.map((email) => String(email).trim().toLowerCase()).filter(Boolean))].map((email) => ({ email, role: 'user' }));
  }
  return [];
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const organization = await resolveOrganization(base44, user);
    const payload = await req.json();
    const invites = normalizeInvites(payload);
    if (invites.length === 0) return Response.json({ invites: [] });

    const existing = await base44.asServiceRole.entities.PendingInvite.filter({ organization_owner_user_id: organization.owner_user_id });
    const results = [];

    for (const invite of invites) {
      if (invite.role === 'admin' && user.role !== 'admin') {
        continue;
      }

      const existingInvite = existing.find((item) => item.invited_email?.toLowerCase() === invite.email);
      if (existingInvite) {
        const updated = await base44.asServiceRole.entities.PendingInvite.update(existingInvite.id, {
          role: invite.role,
          status: 'pending',
          invited_by_user_id: user.id,
        });
        results.push(updated);
      } else {
        const created = await base44.asServiceRole.entities.PendingInvite.create({
          invited_email: invite.email,
          role: invite.role,
          status: 'pending',
          invited_by_user_id: user.id,
          organization_owner_user_id: organization.owner_user_id,
        });
        results.push(created);
      }
    }

    return Response.json({ invites: results });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});