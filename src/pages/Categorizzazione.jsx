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

const categoryOptions = [
  { id: 'da_rispondere', label: 'Da rispondere' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'notifica', label: 'Notifica' },
  { id: 'da_seguire', label: 'Da seguire' },
  { id: 'per_conoscenza', label: 'Per conoscenza' },
  { id: 'pec', label: 'PEC' },
  { id: 'burocrazia', label: 'Burocrazia' },
  { id: 'contratto', label: 'Contratto' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'altro', label: 'Altro' },
];

export default function Categorizzazione() {
  const [tab, setTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newAlternativeEmail, setNewAlternativeEmail] = useState('');
  const [newRulePattern, setNewRulePattern] = useState('');
  const [newRuleCategory, setNewRuleCategory] = useState('da_rispondere');
  const [settings, setSettings] = useState({
    moveOut: { notification: true, followUp: true, marketing: true },
    keepIn: { todo: false, fyi: false },
    respectExisting: true,
    topicLabels: true,
    enableCategorization: true,
    marketingFilter: 'cold_unknown',
    topicStates: Object.fromEntries(topicLabels.map((label) => [label.id, label.enabled])),
    alternativeEmails: [],
    customRules: [],
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
          alternativeEmails: remote.alternative_emails || [],
          customRules: remote.custom_rules || [],
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
        alternative_emails: settings.alternativeEmails,
        custom_rules: settings.customRules,
      });
    } finally {
      setSaving(false);
    }
  };

  const toggle = (path, key) => {
    setSettings((prev) => ({
      ...prev,
      [path]: { ...prev[path], [key]: !prev[path][key] },
    }));
  };

  const addAlternativeEmail = () => {
    const email = newAlternativeEmail.trim().toLowerCase();
    if (!email || settings.alternativeEmails.includes(email)) return;
    setSettings((prev) => ({ ...prev, alternativeEmails: [...prev.alternativeEmails, email] }));
    setNewAlternativeEmail('');
  };

  const removeAlternativeEmail = (email) => {
    setSettings((prev) => ({
      ...prev,
      alternativeEmails: prev.alternativeEmails.filter((item) => item !== email),
    }));
  };

  const addCustomRule = () => {
    const pattern = newRulePattern.trim();
    if (!pattern) return;
    setSettings((prev) => ({
      ...prev,
      customRules: [...prev.customRules, { pattern, category: newRuleCategory }],
    }));
    setNewRulePattern('');
    setNewRuleCategory('da_rispondere');
  };

  const removeCustomRule = (index) => {
    setSettings((prev) => ({
      ...prev,
      customRules: prev.customRules.filter((_, currentIndex) => currentIndex !== index),
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
          {['general', 'advanced'].map((currentTab) => (
            <button
              key={currentTab}
              onClick={() => setTab(currentTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === currentTab ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {currentTab === 'general' ? 'Generale' : 'Avanzate'}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="grid grid-cols-2 gap-6 max-w-4xl">
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Rimuovi dalla mia Inbox</h3>
              <div className="space-y-4">
                {[
                  { key: 'notification', color: 'bg-green-400', label: 'Notifica', desc: 'Notifiche di strumenti automatizzati' },
                  { key: 'followUp', color: 'bg-blue-400', label: 'Da seguire', desc: 'In attesa della loro risposta' },
                  { key: 'marketing', color: 'bg-pink-400', label: 'Marketing', desc: 'Email di vendita e marketing' },
                ].map((item) => (
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

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Mantieni nella mia Inbox</h3>
              <div className="space-y-4">
                {[
                  { key: 'todo', color: 'bg-red-400', label: 'Da fare', desc: 'Richiede la tua azione o risposta' },
                  { key: 'fyi', color: 'bg-orange-400', label: 'Per conoscenza', desc: 'Importante, non richiede risposta' },
                ].map((item) => (
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

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Categorie esistenti</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Rispetta le mie categorie</div>
                  <div className="text-xs text-brand">Non ordineremo le email già etichettate</div>
                </div>
                <Toggle checked={settings.respectExisting} onChange={(value) => setSettings((prev) => ({ ...prev, respectExisting: value }))} />
              </div>
            </div>

            <div className="col-span-2 bg-cream rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Etichette basate su argomento</div>
                  <div className="text-xs text-brand">Permetti a MailMind AI di categorizzare le email dei sistemi automatizzati per argomento.</div>
                </div>
                <Toggle checked={settings.topicLabels} onChange={(value) => setSettings((prev) => ({ ...prev, topicLabels: value }))} />
              </div>
              <div className="border-t border-gray-200 pt-4">
                <div className="grid grid-cols-3 text-xs font-medium text-gray-500 mb-2 px-1">
                  <span>Abilitato?</span>
                  <span>Etichetta</span>
                  <span>Descrizione</span>
                </div>
                <div className="space-y-1.5 max-h-64 overflow-y-auto">
                  {topicLabels.map((label) => (
                    <div key={label.id} className="grid grid-cols-3 items-center py-1.5 border-b border-gray-100 last:border-0">
                      <Toggle
                        checked={settings.topicStates[label.id]}
                        onChange={(value) => setSettings((prev) => ({
                          ...prev,
                          topicStates: { ...prev.topicStates, [label.id]: value },
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
                <Toggle checked={settings.enableCategorization} onChange={(value) => setSettings((prev) => ({ ...prev, enableCategorization: value }))} />
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
                ].map((option) => (
                  <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="marketing"
                      checked={settings.marketingFilter === option.id}
                      onChange={() => setSettings((prev) => ({ ...prev, marketingFilter: option.id }))}
                      className="text-brand"
                    />
                    <span className="text-sm text-gray-700">{option.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Email alternative</h3>
              <p className="text-xs text-gray-500 mb-3">
                Le email da cui invii saranno trattate come indirizzi tuoi aggiuntivi e aiuteranno MailMind AI a riconoscere meglio i follow-up.
              </p>
              <div className="flex gap-2 mb-3">
                <input
                  value={newAlternativeEmail}
                  onChange={(event) => setNewAlternativeEmail(event.target.value)}
                  placeholder="alias@azienda.com"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <button onClick={addAlternativeEmail} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white">
                  Aggiungi
                </button>
              </div>
              <div className="space-y-2">
                {settings.alternativeEmails.length === 0 ? (
                  <p className="text-xs text-gray-400">Nessuna email alternativa configurata</p>
                ) : settings.alternativeEmails.map((email) => (
                  <div key={email} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700">
                    <span>{email}</span>
                    <button onClick={() => removeAlternativeEmail(email)} className="text-xs text-red-500 hover:text-red-600">Rimuovi</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Regole personalizzate</h3>
              <p className="text-xs text-gray-500 mb-3">Scegli quali indirizzi, domini o parole chiave fanno scattare una categoria precisa.</p>
              <div className="space-y-2 mb-4">
                <input
                  value={newRulePattern}
                  onChange={(event) => setNewRulePattern(event.target.value)}
                  placeholder="es. @fornitore.it oppure fattura"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                />
                <div className="flex gap-2">
                  <select
                    value={newRuleCategory}
                    onChange={(event) => setNewRuleCategory(event.target.value)}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    {categoryOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                  <button onClick={addCustomRule} className="px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-white">
                    Aggiungi
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                {settings.customRules.length === 0 ? (
                  <p className="text-xs text-gray-400">Nessuna regola personalizzata</p>
                ) : settings.customRules.map((rule, index) => (
                  <div key={`${rule.pattern}-${index}`} className="flex items-center justify-between bg-white border border-gray-100 rounded-lg px-3 py-2 text-sm text-gray-700 gap-3">
                    <div>
                      <div className="font-medium">{rule.pattern}</div>
                      <div className="text-xs text-brand">{categoryOptions.find((option) => option.id === rule.category)?.label || rule.category}</div>
                    </div>
                    <button onClick={() => removeCustomRule(index)} className="text-xs text-red-500 hover:text-red-600">Rimuovi</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}