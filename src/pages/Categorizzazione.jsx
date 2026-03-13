import { useState } from 'react';

const topicLabels = [
  { key: 'accounts_security', label: 'accounts&security', desc: 'Password, login e avvisi sicurezza account.', enabled: true, color: 'text-brand' },
  { key: 'cold_outreach', label: 'cold outreach', desc: 'Vendite non sollecitate o proposte di partnership.', enabled: false, color: 'text-brand' },
  { key: 'comment', label: 'comment', desc: 'Commenti e menzioni negli strumenti di collaborazione.', enabled: true, color: 'text-brand' },
  { key: 'contract', label: 'contract', desc: 'Stato contratti e richieste di firma.', enabled: true, color: 'text-brand' },
  { key: 'event', label: 'event', desc: 'Inviti e aggiornamenti eventi.', enabled: true, color: 'text-brand' },
  { key: 'mailmind_notetaker', label: 'MailMind notetaker', desc: 'Note e approfondimenti dal notetaker MailMind.', enabled: true, color: 'text-brand' },
  { key: 'meeting_update', label: 'meeting update', desc: 'Inviti calendario, modifiche e promemoria.', enabled: true, color: 'text-brand' },
  { key: 'newsletter', label: 'newsletter', desc: 'Notizie ricorrenti e digest di contenuto.', enabled: true, color: 'text-brand' },
  { key: 'orders', label: 'orders', desc: 'Conferme e aggiornamenti ordini fisici.', enabled: true, color: 'text-brand' },
  { key: 'payment', label: 'payment', desc: 'Fatturazione, fatture e ricevute.', enabled: true, color: 'text-brand' },
  { key: 'promotion', label: 'promotion', desc: 'Promozioni e offerte.', enabled: false, color: 'text-brand' },
  { key: 'submission', label: 'submission', desc: 'Invii di moduli e risposte.', enabled: true, color: 'text-brand' },
  { key: 'tool_alert', label: 'tool alert', desc: 'Avvisi da strumenti e servizi online.', enabled: true, color: 'text-brand' },
];

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${checked ? 'bg-gray-900' : 'bg-gray-200'}`}
  >
    <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${checked ? 'left-5' : 'left-1'}`} />
  </button>
);

export default function Categorizzazione() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState({
    notification: true, followUp: true, marketing: true,
    todo: false, fyi: false, respectCategories: true, topicLabels: true,
  });
  const [topicSettings, setTopicSettings] = useState(
    Object.fromEntries(topicLabels.map(l => [l.key, l.enabled]))
  );
  const [marketingFilter, setMarketingFilter] = useState('cold');
  const [catEnabled, setCatEnabled] = useState(true);

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Categorizzazione</h1>
        <button className="text-sm text-brand font-medium hover:underline">Aggiorna preferenze</button>
      </div>

      <div className="px-8 py-6 max-w-4xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          {['general', 'advanced'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors capitalize ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'general' ? 'Generale' : 'Avanzato'}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="grid md:grid-cols-2 gap-4">
            {/* Move out */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Sposta fuori dalla mia Inbox</h3>
              {[
                { key: 'notification', color: 'bg-green-400', label: 'Notifica', desc: 'Notifiche automatiche strumenti' },
                { key: 'followUp', color: 'bg-blue-400', label: 'Da seguire', desc: 'In attesa della loro risposta' },
                { key: 'marketing', color: 'bg-pink-400', label: 'Marketing', desc: 'Email di vendita e marketing' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.label}</div>
                      <div className="text-xs text-gray-500">{item.desc}</div>
                    </div>
                  </div>
                  <Toggle checked={settings[item.key]} onChange={v => setSettings(s => ({ ...s, [item.key]: v }))} />
                </div>
              ))}
            </div>

            {/* Keep in */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Tieni nella mia Inbox</h3>
              {[
                { key: 'todo', color: 'bg-red-400', label: 'Da fare', desc: 'Richiede la tua azione o risposta' },
                { key: 'fyi', color: 'bg-yellow-400', label: 'Per conoscenza', desc: 'Importante, nessuna risposta necessaria' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${item.color}`} />
                    <div>
                      <div className={`text-sm font-medium ${!settings[item.key] ? 'text-gray-400' : 'text-gray-900'}`}>{item.label}</div>
                      <div className={`text-xs ${!settings[item.key] ? 'text-gray-300' : 'text-gray-500'}`}>{item.desc}</div>
                    </div>
                  </div>
                  <Toggle checked={settings[item.key]} onChange={v => setSettings(s => ({ ...s, [item.key]: v }))} />
                </div>
              ))}
            </div>

            {/* Existing categories */}
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Categorie esistenti</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Rispetta le mie categorie</div>
                  <div className="text-xs text-brand">Non ordineremo email già etichettate</div>
                </div>
                <Toggle checked={settings.respectCategories} onChange={v => setSettings(s => ({ ...s, respectCategories: v }))} />
              </div>
            </div>

            {/* Topic labels */}
            <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">Etichette per argomento</h3>
                  <div className="text-xs text-brand mt-0.5">Permetti a MailMind AI di categorizzare email da sistemi automatici per argomento.</div>
                </div>
                <Toggle checked={settings.topicLabels} onChange={v => setSettings(s => ({ ...s, topicLabels: v }))} />
              </div>
              <div className="border border-gray-100 rounded-lg overflow-hidden">
                <div className="grid grid-cols-3 gap-0 bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-500 border-b border-gray-100">
                  <span>Abilitato?</span>
                  <span>Etichetta</span>
                  <span>Descrizione</span>
                </div>
                {topicLabels.map(label => (
                  <div key={label.key} className="grid grid-cols-3 gap-0 px-4 py-3 border-b border-gray-50 items-center hover:bg-gray-50">
                    <Toggle checked={topicSettings[label.key]} onChange={v => setTopicSettings(s => ({ ...s, [label.key]: v }))} />
                    <span className="text-sm font-medium text-brand">{label.label}</span>
                    <span className="text-sm text-gray-500">{label.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'advanced' && (
          <div className="space-y-4 max-w-2xl">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Abilita categorizzazione?</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita</div>
                  <div className="text-xs text-brand">Attiva o disattiva la categorizzazione globalmente.</div>
                </div>
                <Toggle checked={catEnabled} onChange={setCatEnabled} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Quali email dovrebbe filtrare come marketing?</h3>
              <div className="space-y-2">
                {[
                  { key: 'obvious', label: 'Solo ovvie vendite outreach' },
                  { key: 'cold', label: 'Cold email e mittenti sconosciuti' },
                  { key: 'newsletters', label: 'Cold email, mittenti sconosciuti e newsletter' },
                  { key: 'anything', label: 'Qualsiasi cosa non direttamente utile al mio lavoro' },
                ].map(opt => (
                  <label key={opt.key} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={marketingFilter === opt.key} onChange={() => setMarketingFilter(opt.key)} className="accent-gray-900" />
                    <span className={`text-sm ${marketingFilter === opt.key ? 'text-brand font-medium' : 'text-gray-600'}`}>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Email alternative</h3>
              <p className="text-xs text-gray-500 mb-3">Altri indirizzi email da cui invii saranno etichettati come Azione Presa o In Attesa di Risposta.</p>
              <button className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                + Aggiungi email
              </button>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Regole personalizzate</h3>
              <p className="text-xs text-gray-500 mb-3">Scegli quali indirizzi o domini vanno in ogni categoria.</p>
              <button className="flex items-center gap-1.5 text-sm text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">
                + Aggiungi email o dominio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}