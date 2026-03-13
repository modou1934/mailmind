import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export default function Persone() {
  const [tab, setTab] = useState('members');
  const [showInvite, setShowInvite] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [inviteEmails, setInviteEmails] = useState(['']);
  const [teamName, setTeamName] = useState('');

  return (
    <div className="h-full">
      <div className="flex items-center justify-between px-8 py-4 border-b border-gray-100 bg-white">
        <div className="flex gap-1">
          {['members', 'teams', 'invites'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : `border-transparent ${t === 'invites' ? 'text-brand' : 'text-gray-500'} hover:text-gray-700`}`}>
              {t === 'members' ? 'Membri' : t === 'teams' ? 'Team' : 'Inviti'}
            </button>
          ))}
        </div>
        <button onClick={() => setShowInvite(true)} className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand/90">
          Invita colleghi <Plus className="w-4 h-4" />
        </button>
      </div>

      <div className="px-8 py-6 max-w-2xl">
        {tab === 'members' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900">Colleghi</h3>
              <button onClick={() => setShowInvite(true)} className="flex items-center gap-1 text-sm text-brand font-medium">
                Invita <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500">Membri</div>
              <div className="px-4 py-4 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-brand/10 text-brand flex items-center justify-center font-bold">U</div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-gray-900">Il tuo nome</span>
                    <span className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded font-medium">TU</span>
                  </div>
                  <div className="text-xs text-gray-500">Super admin · utente@gmail.com</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'teams' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-gray-900">Collabora con il tuo team</h3>
                <p className="text-xs text-gray-500">Controlla funzionalità e accesso in modo sicuro, tutto in un posto. <span className="text-brand">all in one place.</span></p>
              </div>
              <button onClick={() => setShowCreateTeam(true)} className="flex items-center gap-1 text-sm text-gray-700 font-medium border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                Crea team <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <p className="text-sm text-brand">Nessun team ancora. Creane uno per iniziare.</p>
            </div>
          </div>
        )}

        {tab === 'invites' && (
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
                <p className="text-sm text-brand">Nessun invito in sospeso</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Invita colleghi</h3>
              <button onClick={() => setShowInvite(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Invieremo a ogni collega un'email con un link per unirsi alla tua organizzazione. Il link scade in una settimana.</p>
            <div className="space-y-2 mb-3">
              {inviteEmails.map((email, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={e => { const emails = [...inviteEmails]; emails[i] = e.target.value; setInviteEmails(emails); }}
                    placeholder="email@esempio.com"
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-brand outline-none"
                  />
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg px-2 py-2">
                    <span className="text-xs text-gray-600">Membro</span>
                  </div>
                </div>
              ))}
              <button onClick={() => setInviteEmails([...inviteEmails, ''])} className="flex items-center gap-1 text-sm text-brand font-medium">
                <Plus className="w-4 h-4" /> Aggiungi un'altra email
              </button>
            </div>
            <div className="border-t border-gray-100 pt-3 mb-4">
              <div className="flex items-center justify-center gap-2">
                <span className="text-xs text-gray-400">oppure</span>
              </div>
              <button className="flex items-center gap-2 text-sm text-gray-600 mt-2">
                Copia link invito 🔗
              </button>
            </div>
            <div className="bg-gray-50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl flex items-center justify-end gap-3">
              <button onClick={() => setShowInvite(false)} className="text-sm text-gray-500 px-3 py-2">Annulla</button>
              <button className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold">Invia Inviti</button>
            </div>
          </div>
        </div>
      )}

      {/* Create team modal */}
      {showCreateTeam && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Crea team</h3>
              <button onClick={() => setShowCreateTeam(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Aggiorna il nome del team così i tuoi colleghi sanno dove unirsi.</p>
            <div className="mb-4">
              <div className="text-xs text-gray-500 mb-1 border border-gray-100 rounded px-2 py-0.5 inline-block">Nome team</div>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="es. Ingegneria" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:border-brand outline-none" />
            </div>
            <div className="mb-4">
              <div className="text-sm font-medium text-gray-700 mb-1">Membri</div>
              <p className="text-xs text-gray-400">Clicca su un membro per aggiungerlo o rimuoverlo dal team</p>
            </div>
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => setShowCreateTeam(false)} className="text-sm text-gray-500">Annulla</button>
              <button disabled={!teamName} className={`px-4 py-2 rounded-lg text-sm font-medium ${teamName ? 'text-brand' : 'text-gray-300 cursor-not-allowed'}`}>Crea team</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}