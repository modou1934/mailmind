import { useState } from 'react';
import { X, Plus, Copy } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Persone() {
  const [tab, setTab] = useState('members');
  const [inviteModal, setInviteModal] = useState(false);
  const [createTeamModal, setCreateTeamModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [extraEmails, setExtraEmails] = useState([]);
  const [newTeamName, setNewTeamName] = useState('');

  const handleInvite = async () => {
    if (!inviteEmail) return;
    await base44.users.inviteUser(inviteEmail, 'user');
    setInviteModal(false);
    setInviteEmail('');
  };

  return (
    <div className="p-6 max-w-3xl">
      {/* Top button */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => setInviteModal(true)}
          className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
        >
          <Plus className="w-4 h-4" /> Invita colleghi
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200 mb-5">
        {['members', 'teams', 'invites'].map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {{ members: 'Membri', teams: 'Team', invites: 'Inviti' }[t]}
          </button>
        ))}
      </div>

      {tab === 'members' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Colleghi</h3>
            <button onClick={() => setInviteModal(true)} className="text-sm text-brand font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Invita
            </button>
          </div>
          <div className="bg-cream rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">Membri</div>
            <div className="p-4">
              <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100">
                <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-sm font-bold">U</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">Utente</span>
                    <span className="text-[10px] bg-gray-900 text-white rounded-sm px-1.5 py-0.5 font-bold">TU</span>
                  </div>
                  <div className="text-xs text-gray-500">Super admin • utente@gmail.com</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === 'teams' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Collabora con il tuo team</h3>
              <p className="text-xs text-gray-500">Controlla funzionalità e accessi in modo sicuro, tutto in un posto.</p>
            </div>
            <button onClick={() => setCreateTeamModal(true)} className="text-sm text-brand font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Crea team
            </button>
          </div>
          <div className="bg-cream rounded-xl border border-gray-200 p-8 text-center">
            <p className="text-sm text-brand">Nessun team ancora. Creane uno per iniziare.</p>
          </div>
        </div>
      )}

      {tab === 'invites' && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Inviti in sospeso</h3>
              <p className="text-xs text-gray-500">Le persone che hai invitato ad unirti al team appariranno qui.</p>
            </div>
            <button onClick={() => setInviteModal(true)} className="text-sm text-brand font-medium flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Invita
            </button>
          </div>
          <div className="bg-cream rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-2 text-xs font-semibold text-gray-500 bg-gray-50 border-b border-gray-100">Inviti</div>
            <div className="p-6 text-center">
              <p className="text-sm text-brand">Nessun invito in sospeso</p>
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Invita colleghi</h3>
              <button onClick={() => setInviteModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Invieremo a ogni collega un'email con un link per unirsi alla tua organizzazione. Il link scade in una settimana.</p>
            <div className="flex gap-2 mb-3">
              <input
                type="email"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="email@esempio.com"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
              <select className="border border-gray-200 rounded-lg px-2 py-2.5 text-sm focus:outline-none bg-white">
                <option>Membro</option>
                <option>Admin</option>
              </select>
            </div>
            {extraEmails.map((email, i) => (
              <div key={i} className="flex gap-2 mb-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => { const n = [...extraEmails]; n[i] = e.target.value; setExtraEmails(n); }}
                  placeholder="email@esempio.com"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none"
                />
                <button onClick={() => setExtraEmails(extraEmails.filter((_, j) => j !== i))} className="text-gray-400 px-2">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setExtraEmails([...extraEmails, ''])}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4"
            >
              <Plus className="w-3.5 h-3.5" /> Aggiungi un'altra email
            </button>
            <div className="flex items-center gap-2 mb-4">
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">o</span>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <button className="flex items-center gap-2 text-sm text-gray-700 hover:text-gray-900 mb-4">
              <Copy className="w-4 h-4" /> Copia link di invito
            </button>
            <div className="flex gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setInviteModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Annulla
              </button>
              <button onClick={handleInvite} className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90">
                Invia Inviti
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create team modal */}
      {createTeamModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Crea team</h3>
              <button onClick={() => setCreateTeamModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Aggiorna il nome del team così i tuoi colleghi sapranno dove unirsi.</p>
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Nome team</label>
              <input
                type="text"
                value={newTeamName}
                onChange={e => setNewTeamName(e.target.value)}
                placeholder="es. Ingegneria"
                className="w-full border-2 border-brand rounded-lg px-3 py-2.5 text-sm focus:outline-none"
              />
            </div>
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1">Membri</div>
              <p className="text-xs text-gray-400">Clicca su un membro per aggiungerlo o rimuoverlo dal team</p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCreateTeamModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">
                Annulla
              </button>
              <button
                disabled={!newTeamName}
                onClick={() => setCreateTeamModal(false)}
                className="flex-1 py-2.5 bg-gray-200 text-gray-400 rounded-xl text-sm font-semibold disabled:cursor-not-allowed"
              >
                Crea team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}