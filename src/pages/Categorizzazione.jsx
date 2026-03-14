import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative w-10 h-5.5 rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
    style={{ height: '22px', width: '40px' }}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const topicLabels = [
  { id: 'accounts', label: 'accounts&security', desc: 'Password, accessi e avvisi di sicurezza.', enabled: true },
  { id: 'coldOutreach', label: 'cold outreach', desc: 'Vendite non sollecitate o proposte di partnership.', enabled: false },
  { id: 'comment', label: 'commento', desc: 'Commenti e menzioni negli strumenti di collaborazione.', enabled: true },
  { id: 'contract', label: 'contratto', desc: 'Stato del contratto e richieste di firma.', enabled: true },
  { id: 'event', label: 'evento', desc: 'Inviti a eventi e aggiornamenti.', enabled: true },
  { id: 'notetaker', label: 'MailMind notetaker', desc: 'Note e approfondimenti dal notetaker MailMind.', enabled: true },
  { id: 'meeting', label: 'aggiornamento riunione', desc: 'Inviti al calendario, modifiche e promemoria.', enabled: true },
  { id: 'newsletter', label: 'newsletter', desc: 'Notizie ricorrenti e digest di contenuti.', enabled: true },
  { id: 'orders', label: 'ordini', desc: 'Conferme di ordini fisici e aggiornamenti.', enabled: true },
  { id: 'payment', label: 'pagamento', desc: 'Fatturazione, fatture e ricevute.', enabled: true },
  { id: 'promotion', label: 'promozione', desc: 'Promozioni e offerte.', enabled: false },
  { id: 'submission', label: 'invio', desc: 'Invii di moduli e risposte.', enabled: true },
  { id: 'toolAlert', label: 'tool alert', desc: 'Avvisi da strumenti e servizi online.', enabled: true },
  { id: 'pec', label: 'PEC', desc: 'Posta Elettronica Certificata — notifiche legali e PA.', enabled: true },
  { id: 'burocrazia', label: 'burocrazia', desc: 'PA, fisco, enti pubblici e comunicazioni ufficiali.', enabled: true },
];

export default function Categorizzazione() {
  const [tab, setTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    moveOut: { notification: true, followUp: true, marketing: true },
    keepIn: { todo: false, fyi: false },
    respectExisting: true,
    topicLabels: true,
    enableCategorization: true,
    marketingFilter: 'cold_unknown',
    topicStates: Object.fromEntries(topicLabels.map(l => [l.id, l.enabled])),
  });

  useEffect(() => {
    let active = true;

    base44.functions.invoke('getInboxSettings', {})
      .then((res) => {
        if (!active || !res.data?.settings) return;
        const remote = res.data.settings;
        setSettings({
          moveOut: {
            notification: remote.move_notification_out,
            followUp: remote.move_follow_up_out,
            marketing: remote.move_marketing_out,
          },
          keepIn: {
            todo: remote.keep_todo_in_inbox,
            fyi: remote.keep_fyi_in_inbox,
          },
          respectExisting: remote.respect_existing_categories,
          topicLabels: remote.enable_topic_labels,
          enableCategorization: remote.enable_categorization,
          marketingFilter: remote.marketing_filter_mode,
          topicStates: {
            ...Object.fromEntries(topicLabels.map((label) => [label.id, label.enabled])),
            ...(remote.topic_states || {}),
          },
        });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('saveInboxSettings', {
        move_notification_out: settings.moveOut.notification,
        move_follow_up_out: settings.moveOut.followUp,
        move_marketing_out: settings.moveOut.marketing,
        keep_todo_in_inbox: settings.keepIn.todo,
        keep_fyi_in_inbox: settings.keepIn.fyi,
        respect_existing_categories: settings.respectExisting,
        enable_topic_labels: settings.topicLabels,
        enable_categorization: settings.enableCategorization,
        marketing_filter_mode: settings.marketingFilter,
        topic_states: settings.topicStates,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (path, key) => {
    setSettings(prev => ({
      ...prev,
      [path]: { ...prev[path], [key]: !prev[path][key] }
    }));
  };

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Categorizzazione</h1>
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium disabled:opacity-50"
        >
          {loading ? 'Caricamento...' : saving ? 'Salvataggio...' : 'Aggiorna preferenze'}
        </button>
      </div>

      <div className="px-6 pt-5">
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          {['general', 'advanced'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t === 'general' ? 'Generale' : 'Avanzate'}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl">
            {/* Move out */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Rimuovi dalla mia Inbox</h3>
              <div className="space-y-4">
                {[
                  { key: 'notification', color: 'bg-green-400', label: 'Notifica', desc: 'Notifiche di strumenti automatizzati' },
                  { key: 'followUp', color: 'bg-blue-400', label: 'Da seguire', desc: 'In attesa della loro risposta' },
                  { key: 'marketing', color: 'bg-pink-400', label: 'Marketing', desc: 'Email di vendita e marketing' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="flex items-start gap-2">
                      <div className={`w-3 h-3 rounded-full ${item.color} mt-0.5 flex-shrink-0`} />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.label}</div>
                        <div className="text-xs text-gray-500">{item.desc}</div>
                      </div>
                    </div>
                    <Toggle checked={settings.moveOut[item.key]} onChange={() => toggle('moveOut', item.key)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Keep in */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Mantieni nella mia Inbox</h3>
              <div className="space-y-4">
                {[
                  { key: 'todo', color: 'bg-red-400', label: 'Da fare', desc: 'Richiede la tua azione o risposta' },
                  { key: 'fyi', color: 'bg-orange-400', label: 'Per conoscenza', desc: 'Importante, non richiede risposta' },
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between">
                    <div className="flex items-start gap-2">
                      <div className={`w-3 h-3 rounded-full ${item.color} mt-0.5 flex-shrink-0`} />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.label}</div>
                        <div className="text-xs text-gray-500">{item.desc}</div>
                      </div>
                    </div>
                    <Toggle checked={settings.keepIn[item.key]} onChange={() => toggle('keepIn', item.key)} />
                  </div>
                ))}
              </div>
            </div>

            {/* Existing categories */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Categorie esistenti</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Rispetta le mie categorie</div>
                  <div className="text-xs text-brand">Non ordineremo le email già etichettate</div>
                </div>
                <Toggle checked={settings.respectExisting} onChange={v => setSettings(p => ({ ...p, respectExisting: v }))} />
              </div>
            </div>

            {/* Topic-based labels */}
            <div className="col-span-2 bg-cream rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Etichette basate su argomento</div>
                  <div className="text-xs text-brand">Permetti a MailMind AI di categorizzare le email dei sistemi automatizzati per argomento.</div>
                </div>
                <Toggle checked={settings.topicLabels} onChange={v => setSettings(p => ({ ...p, topicLabels: v }))} />
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-3 text-xs font-medium text-gray-500 mb-2 px-1">
                  <span>Abilitato?</span>
                  <span>Etichetta</span>
                  <span>Descrizione</span>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {topicLabels.map(label => (
                    <div key={label.id} className="grid grid-cols-3 items-center py-1.5 border-b border-gray-100 last:border-0">
                      <Toggle
                        checked={settings.topicStates[label.id]}
                        onChange={v => setSettings(p => ({
                          ...p,
                          topicStates: { ...p.topicStates, [label.id]: v }
                        }))}
                      />
                      <span className={`text-sm font-medium ${['pec', 'burocrazia', 'cold outreach'].includes(label.label) ? 'text-brand' : 'text-gray-700'}`}>
                        {label.label}
                        {['pec', 'burocrazia'].includes(label.label) && (
                          <span className="ml-1.5 text-[10px] bg-brand/10 text-brand rounded px-1 py-0.5">IT</span>
                        )}
                      </span>
                      <span className="text-xs text-gray-500">{label.desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === 'advanced' && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Abilita categorizzazione?</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita</div>
                  <div className="text-xs text-brand">Attiva o disattiva la categorizzazione globalmente.</div>
                </div>
                <Toggle checked={settings.enableCategorization} onChange={v => setSettings(p => ({ ...p, enableCategorization: v }))} />
              </div>
            </div>

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Quali email filtrare come marketing?</h3>
              <div className="space-y-2">
                {[
                  { id: 'obvious', label: 'Solo vendita outreach evidente' },
                  { id: 'cold_unknown', label: 'Cold email e mittenti sconosciuti' },
                  { id: 'cold_newsletter', label: 'Cold email, mittenti sconosciuti e newsletter' },
                  { id: 'all', label: 'Tutto ciò che non è direttamente utile al mio lavoro' },
                ].map(opt => (
                  <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="marketing"
                      checked={settings.marketingFilter === opt.id}
                      onChange={() => setSettings(p => ({ ...p, marketingFilter: opt.id }))}
                      className="text-brand"
                    />
                    <span className="text-sm text-gray-700">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Email alternative</h3>
              <p className="text-xs text-gray-500 mb-3">
                Le email da cui invii saranno etichettate come Eseguito o In attesa di risposta.
              </p>
              <button className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium">
                + Aggiungi email
              </button>
            </div>

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Regole personalizzate</h3>
              <p className="text-xs text-gray-500 mb-3">Scegli quali indirizzi o domini vanno in ogni categoria.</p>
              <button className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium">
                + Aggiungi email o dominio
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}