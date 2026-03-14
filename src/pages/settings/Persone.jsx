import { useEffect, useMemo, useState } from 'react';
import { Plus, X, Pencil } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

export default function Persone() {
  const [tab, setTab] = useState('members');
  const [loading, setLoading] = useState(true);
  const [workspaceMeta, setWorkspaceMeta] = useState({ is_owner: false });
  const [submittingInvites, setSubmittingInvites] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [inviteRows, setInviteRows] = useState([{ email: '', role: 'user' }]);
  const [teamName, setTeamName] = useState('');
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState([]);
  const { toast } = useToast();

  const isAdmin = useMemo(() => members.some((member) => member.is_owner || member.role === 'admin'), [members]);

  const loadWorkspace = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getWorkspacePeople', {});
      setWorkspaceMeta({ is_owner: Boolean(res.data?.is_owner) });
      setMembers(res.data?.members || []);
      setTeams(res.data?.teams || []);
      setInvites(res.data?.invites || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorkspace();
  }, []);

  const handleSendInvites = async () => {
    const invitesPayload = inviteRows.map((row) => ({ email: row.email.trim().toLowerCase(), role: row.role })).filter((row) => row.email);
    if (invitesPayload.length === 0) return;

    setSubmittingInvites(true);
    try {
      for (const invite of invitesPayload) {
        await base44.users.inviteUser(invite.email, invite.role);
      }
      await base44.functions.invoke('recordWorkspaceInvites', { invites: invitesPayload });
      setShowInvite(false);
      setInviteRows([{ email: '', role: 'user' }]);
      await loadWorkspace();
      toast({ title: 'Inviti inviati' });
    } finally {
      setSubmittingInvites(false);
    }
  };

  const handleOpenCreateTeam = () => {
    setEditingTeamId(null);
    setTeamName('');
    setSelectedMemberIds([]);
    setShowTeamModal(true);
  };

  const handleOpenEditTeam = (team) => {
    setEditingTeamId(team.id);
    setTeamName(team.name);
    setSelectedMemberIds(team.member_ids || []);
    setShowTeamModal(true);
  };

  const handleSaveTeam = async () => {
    if (!teamName.trim()) return;
    setSavingTeam(true);
    try {
      await base44.functions.invoke('saveWorkspaceTeam', {
        team_id: editingTeamId,
        name: teamName,
        member_user_ids: selectedMemberIds,
      });
      setShowTeamModal(false);
      setTeamName('');
      setEditingTeamId(null);
      setSelectedMemberIds([]);
      await loadWorkspace();
      toast({ title: editingTeamId ? 'Team aggiornato' : 'Team creato' });
    } finally {
      setSavingTeam(false);
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    await base44.functions.invoke('revokeWorkspaceInvite', { invite_id: inviteId });
    await loadWorkspace();
    toast({ title: 'Invito revocato' });
  };

  const handleRoleChange = async (memberId, role) => {
    await base44.functions.invoke('updateWorkspaceMemberRole', { member_id: memberId, role });
    await loadWorkspace();
    toast({ title: 'Ruolo aggiornato' });
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white">
        <div className="flex gap-1">
          {['members', 'teams', 'invites'].map((currentTab) => (
            <button key={currentTab} onClick={() => setTab(currentTab)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === currentTab ? 'border-gray-900 text-gray-900' : `border-transparent ${currentTab === 'invites' ? 'text-brand' : 'text-gray-500'} hover:text-gray-700`}`}>
              {currentTab === 'members' ? 'Membri' : currentTab === 'teams' ? 'Team' : 'Inviti'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand/90">
          Invita colleghi <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="px-8 py-6 max-w-3xl">
        {tab === 'members' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">Membri</div>
            {loading ? <div className="px-4 py-6 text-sm text-gray-400">Caricamento membri...</div> : members.map((member) => (
              <div key={member.id} className="px-4 py-4 flex items-center justify-between gap-4 border-t border-gray-50 first:border-t-0">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold">{(member.full_name || member.email).slice(0,1).toUpperCase()}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{member.full_name}</span>
                      {member.is_owner && <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded font-medium">OWNER</span>}
                    </div>
                    <div className="text-xs text-gray-500">{member.email}</div>
                  </div>
                </div>
                <select disabled={!workspaceMeta.is_owner || member.is_owner} value={member.role} onChange={(e) => handleRoleChange(member.id, e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm disabled:bg-gray-50">
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            ))}
          </div>
        )}

        {tab === 'teams' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Team</h3>
                <p className="text-xs text-gray-500">Gestisci membri e gruppi di lavoro.</p>
              </div>
              <button onClick={handleOpenCreateTeam} className="flex items-center gap-1 text-sm text-gray-700 font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                Crea team <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3">
              {loading ? <div className="text-sm text-gray-400">Caricamento team...</div> : teams.length === 0 ? <div className="bg-white rounded-xl border border-gray-100 p-8 text-center text-sm text-brand">Nessun team ancora. Creane uno per iniziare.</div> : teams.map((team) => (
                <div key={team.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{team.name}</div>
                    <div className="text-xs text-gray-500 mt-1">{team.member_count} membri</div>
                    {team.member_names?.length > 0 && <div className="text-xs text-brand mt-2">{team.member_names.join(', ')}</div>}
                  </div>
                  <button onClick={() => handleOpenEditTeam(team)} className="text-sm text-gray-500 hover:text-gray-900"><Pencil className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'invites' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">Inviti</div>
            {loading ? <div className="px-4 py-6 text-sm text-gray-400">Caricamento inviti...</div> : invites.length === 0 ? <div className="px-4 py-6 text-center text-sm text-brand">Nessun invito</div> : invites.map((invite) => (
              <div key={invite.id} className="px-4 py-4 flex items-center justify-between gap-4 border-t border-gray-50 first:border-t-0">
                <div>
                  <div className="text-sm font-medium text-gray-900">{invite.invited_email}</div>
                  <div className="text-xs text-gray-500">{invite.status} · ruolo {invite.role}</div>
                </div>
                {invite.status === 'pending' && <button onClick={() => handleRevokeInvite(invite.id)} className="text-xs text-red-500 hover:text-red-600">Revoca</button>}
              </div>
            ))}
          </div>
        )}
      </div>

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Invita colleghi</h3>
              <button onClick={() => setShowInvite(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="space-y-3 mb-4">
              {inviteRows.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input value={row.email} onChange={(e) => setInviteRows((prev) => prev.map((item, i) => i === index ? { ...item, email: e.target.value } : item))} placeholder="email@esempio.com" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <select value={row.role} onChange={(e) => setInviteRows((prev) => prev.map((item, i) => i === index ? { ...item, role: e.target.value } : item))} className="border border-gray-200 rounded-lg px-3 py-2 text-sm">
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
              ))}
              <button onClick={() => setInviteRows((prev) => [...prev, { email: '', role: 'user' }])} className="flex items-center gap-1 text-sm text-brand font-medium"><Plus className="w-4 h-4" /> Aggiungi un'altra email</button>
            </div>
            <div className="bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
              <button onClick={() => setShowInvite(false)} className="text-sm text-gray-500 px-3 py-2">Annulla</button>
              <button onClick={handleSendInvites} disabled={submittingInvites} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">{submittingInvites ? 'Invio...' : 'Invia Inviti'}</button>
            </div>
          </div>
        </div>
      )}

      {showTeamModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">{editingTeamId ? 'Modifica team' : 'Crea team'}</h3>
              <button onClick={() => setShowTeamModal(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1 border border-gray-100 rounded px-2 py-0.5 inline-block">Nome team</div>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="es. Ingegneria" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-1">Membri</div>
              <div className="space-y-2 max-h-48 overflow-auto">
                {members.map((member) => (
                  <button key={member.id} onClick={() => setSelectedMemberIds((prev) => prev.includes(member.id) ? prev.filter((id) => id !== member.id) : [...prev, member.id])} className={`w-full text-left border rounded-lg px-3 py-2 text-sm ${selectedMemberIds.includes(member.id) ? 'border-brand bg-brand/5 text-brand' : 'border-gray-200 text-gray-700'}`}>
                    {member.full_name} <span className="text-xs text-gray-400">· {member.email}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowTeamModal(false)} className="text-sm text-gray-500">Annulla</button>
              <button onClick={handleSaveTeam} disabled={!teamName || savingTeam} className={`px-4 py-2 rounded-lg text-sm font-medium ${teamName ? 'text-brand' : 'text-gray-300 cursor-not-allowed'}`}>{savingTeam ? 'Salvataggio...' : editingTeamId ? 'Aggiorna team' : 'Crea team'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}