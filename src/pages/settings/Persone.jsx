import { useEffect, useState } from "react";
import { Plus, X, Users, UserPlus, Layers3 } from "lucide-react";
import { api } from "@/api/privateApiClient";

export default function Persone() {
  const [tab, setTab] = useState("members");
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [inviteEmails, setInviteEmails] = useState([""]);
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [invites, setInvites] = useState([]);

  const loadWorkspaceData = async () => {
    try {
      const [membersPayload, teamsPayload, invitesPayload] = await Promise.all([
        api.get("/workspace/members"),
        api.get("/workspace/teams"),
        api.get("/workspace/invites"),
      ]);
      setMembers(membersPayload.members || []);
      setTeams(teamsPayload.teams || []);
      setInvites(invitesPayload.invites || []);
    } catch (error) {
      console.error("Failed to load workspace people", error);
    }
  };

  useEffect(() => {
    loadWorkspaceData();
  }, []);

  const submitInvites = async () => {
    try {
      const validEmails = inviteEmails.map((email) => email.trim()).filter(Boolean);
      await Promise.all(validEmails.map((email) => api.post("/workspace/invites", { email, role: "member" })));
      setInviteEmails([""]);
      setShowInvite(false);
      await loadWorkspaceData();
    } catch (error) {
      console.error("Failed to create invites", error);
    }
  };

  const submitTeam = async () => {
    try {
      if (!teamName.trim()) {
        return;
      }
      await api.post("/workspace/teams", { name: teamName.trim() });
      setTeamName("");
      setShowCreateTeam(false);
      await loadWorkspaceData();
    } catch (error) {
      console.error("Failed to create team", error);
    }
  };

  return (
    <div className="h-full">
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white">
        <div className="flex gap-1">
          {["members", "teams", "invites"].map((entry) => (
            <button
              key={entry}
              onClick={() => setTab(entry)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === entry ? "border-gray-900 text-gray-900" : `border-transparent ${entry === "invites" ? "text-brand" : "text-gray-500"} hover:text-gray-700`}`}
            >
              {entry === "members" ? "Membri" : entry === "teams" ? "Team" : "Inviti"}
            </button>
          ))}
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand/90">
          Invita colleghi <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="px-8 py-6 max-w-2xl">
        <div className="grid gap-4 md:grid-cols-3 mb-5">
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400"><Users className="w-3.5 h-3.5" /> Membri</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{members.length}</div>
            <div className="text-xs text-gray-500">Persone gia' attive nel workspace.</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400"><Layers3 className="w-3.5 h-3.5" /> Team</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{teams.length}</div>
            <div className="text-xs text-gray-500">Gruppi interni per accesso e pianificazione.</div>
          </div>
          <div className="rounded-xl border border-gray-100 bg-white p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400"><UserPlus className="w-3.5 h-3.5" /> Inviti</div>
            <div className="mt-2 text-2xl font-semibold text-gray-900">{invites.length}</div>
            <div className="text-xs text-gray-500">Inviti in sospeso da convertire in membri.</div>
          </div>
        </div>

        {tab === "members" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Colleghi</h3>
              <button onClick={() => setShowInvite(true)} className="flex items-center gap-1 text-sm text-brand font-medium">
                Invita <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">Membri</div>
              {members.map((member, index) => (
                <div key={member.id} className={`px-4 py-4 flex items-center gap-3 ${index < members.length - 1 ? "border-b border-gray-100" : ""}`}>
                  <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold">
                    {(member.full_name || member.email || "U").slice(0, 1).toUpperCase()}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{member.full_name}</span>
                      {index === 0 ? <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded font-medium">TU</span> : null}
                    </div>
                    <div className="text-xs text-gray-500">{member.role} · {member.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === "teams" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Collabora con il tuo team</h3>
                <p className="text-xs text-gray-500">Controlla funzionalita e accesso in modo sicuro, tutto in un posto. <span className="text-brand">all in one place.</span></p>
              </div>
              <button onClick={() => setShowCreateTeam(true)} className="flex items-center gap-1 text-sm text-gray-700 font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                Crea team <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              {teams.length ? (
                <div className="space-y-3">
                  {teams.map((team) => (
                    <div key={team.id} className="text-sm text-gray-700">{team.name}</div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-brand">Nessun team ancora. Creane uno per iniziare.</p>
              )}
            </div>
          </div>
        )}

        {tab === "invites" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Inviti In Sospeso</h3>
                <p className="text-xs text-gray-500">Le persone che hai invitato a unirsi al tuo team appariranno qui.</p>
              </div>
              <button onClick={() => setShowInvite(true)} className="flex items-center gap-1 text-sm text-brand font-medium">
                Invita <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">Inviti</div>
              <div className="px-4 py-6 text-center">
                {invites.length ? (
                  <div className="space-y-2">
                    {invites.map((invite) => (
                      <div key={invite.id} className="text-sm text-gray-700">
                        {invite.email} <span className="text-xs text-gray-400">({invite.status})</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-brand">Nessun invito in sospeso</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Invita colleghi</h3>
              <button onClick={() => setShowInvite(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Gli inviti vengono ora salvati sul backend privato del progetto.</p>
            <div className="space-y-2 mb-3">
              {inviteEmails.map((email, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => {
                      const nextEmails = [...inviteEmails];
                      nextEmails[index] = event.target.value;
                      setInviteEmails(nextEmails);
                    }}
                    placeholder="email@esempio.com"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none"
                  />
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-2">
                    <span className="text-xs text-gray-600">Membro</span>
                  </div>
                </div>
              ))}
              <button onClick={() => setInviteEmails([...inviteEmails, ""])} className="flex items-center gap-1 text-sm text-brand font-medium">
                <Plus className="w-4 h-4" /> Aggiungi un'altra email
              </button>
            </div>
            <div className="bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
              <button onClick={() => setShowInvite(false)} className="text-sm text-gray-500 px-3 py-2">Annulla</button>
              <button onClick={submitInvites} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold">Invia Inviti</button>
            </div>
          </div>
        </div>
      )}

      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Crea team</h3>
              <button onClick={() => setShowCreateTeam(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Il team viene creato sul backend privato e rimane nel database locale.</p>
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1 border border-gray-100 rounded px-2 py-0.5 inline-block">Nome team</div>
              <input value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="es. Ingegneria" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:border-brand outline-none" />
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateTeam(false)} className="text-sm text-gray-500">Annulla</button>
              <button disabled={!teamName.trim()} onClick={submitTeam} className={`px-4 py-2 rounded-lg text-sm font-medium ${teamName.trim() ? "text-brand" : "text-gray-300 cursor-not-allowed"}`}>Crea team</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
