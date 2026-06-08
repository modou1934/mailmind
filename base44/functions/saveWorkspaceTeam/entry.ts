import { createClientFromRequest } from 'npm:@base44/sdk@0.8.20';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const payload = await req.json();
    const teamId = String(payload.team_id || '').trim();
    const teamName = String(payload.name || '').trim();
    const memberIds = Array.isArray(payload.member_user_ids) ? [...new Set(payload.member_user_ids)] : [];
    if (!teamName) return Response.json({ error: 'Team name required' }, { status: 400 });

    let team;
    if (teamId) {
      team = await base44.asServiceRole.entities.Team.update(teamId, {
        name: teamName,
        description: payload.description || '',
      });
      const memberships = await base44.asServiceRole.entities.TeamMembership.filter({ team_id: teamId });
      for (const membership of memberships) {
        await base44.asServiceRole.entities.TeamMembership.delete(membership.id);
      }
    } else {
      team = await base44.asServiceRole.entities.Team.create({
        owner_user_id: user.id,
        name: teamName,
        description: payload.description || '',
      });
    }

    if (memberIds.length > 0) {
      await base44.asServiceRole.entities.TeamMembership.bulkCreate(memberIds.map((memberId) => ({ team_id: team.id, user_id: memberId })));
    }

    return Response.json({ team });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});