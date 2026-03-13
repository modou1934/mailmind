import { useState } from 'react';
import { Users } from 'lucide-react';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
    style={{ height: '22px', width: '40px' }}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

export default function Organizzazione() {
  const [orgName, setOrgName] = useState('Il mio Studio');
  const [orgDomain, setOrgDomain] = useState('');
  const [autoAdd, setAutoAdd] = useState(true);
  const [discoverable, setDiscoverable] = useState(true);

  return (
    <div className="p-6 max-w-2xl space-y-5">
      {/* Invite team */}
      <div className="bg-cream rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Users className="w-5 h-5 text-gray-500" />
          <div>
            <div className="text-sm font-semibold text-gray-900">Invita il tuo team</div>
            <div className="text-xs text-gray-500">MailMind AI diventa più intelligente quando i colleghi condividono il contesto. Invitali a collaborare.</div>
          </div>
        </div>
        <button className="text-sm font-semibold text-brand flex items-center gap-1 whitespace-nowrap hover:underline">
          Aggiungi colleghi →
        </button>
      </div>

      {/* Org details */}
      <div className="bg-cream rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Dettagli Organizzazione</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Nome Organizzazione</label>
            <input
              type="text"
              value={orgName}
              onChange={e => setOrgName(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Dominio Organizzazione</label>
            <input
              type="text"
              value={orgDomain}
              onChange={e => setOrgDomain(e.target.value)}
              placeholder="esempio.com"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
            />
            <p className="text-xs text-gray-400 mt-1">I colleghi con questo dominio email possono unirsi automaticamente quando si registrano.</p>
          </div>
        </div>
      </div>

      {/* Members & access */}
      <div className="bg-cream rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Membri e Accesso</h3>
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-sm font-medium text-gray-900">Aggiungi automaticamente utenti per questo dominio</div>
              <div className="text-xs text-brand">I colleghi con il tuo dominio email si uniranno automaticamente quando si registrano a MailMind AI</div>
            </div>
            <Toggle checked={autoAdd} onChange={setAutoAdd} />
          </div>
          <div className="flex items-start justify-between border-t border-gray-100 pt-4">
            <div>
              <div className="text-sm font-medium text-gray-900">Organizzazione rilevabile</div>
              <div className="text-xs text-brand">I nuovi colleghi vedranno questa organizzazione quando si registrano con il tuo dominio</div>
            </div>
            <Toggle checked={discoverable} onChange={setDiscoverable} />
          </div>
        </div>
      </div>

      {/* Danger zone */}
      <div className="bg-cream rounded-xl border border-red-200 p-5">
        <h3 className="text-sm font-semibold text-red-600 mb-2">Zona Pericolosa</h3>
        <p className="text-xs text-gray-500 mb-4">Azioni irreversibili per la tua organizzazione</p>
        <div className="flex gap-3">
          <button className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors">
            Lascia organizzazione
          </button>
          <button className="px-4 py-2 text-sm border border-red-300 rounded-lg text-red-600 hover:bg-red-50 transition-colors">
            Elimina organizzazione
          </button>
        </div>
      </div>
    </div>
  );
}