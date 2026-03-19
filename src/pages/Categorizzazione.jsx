import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/api/privateApiClient';
import { useToast } from '@/components/ui/use-toast';

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
  const [settings, setSettings] = useState({
    moveOut: { notification: true, followUp: true, marketing: true },
    keepIn: { todo: false, fyi: false },
    respectExisting: true,
    topicLabels: true,
    enableCategorization: true,
    marketingFilter: 'cold_unknown',
    topicStates: Object.fromEntries(topicLabels.map(l => [l.id, l.enabled])),
  });
  const [threads, setThreads] = useState([]);
  const [emailRules, setEmailRules] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [savingRuleSet, setSavingRuleSet] = useState(false);
  const [relabelingThreadId, setRelabelingThreadId] = useState('');
  const { toast } = useToast();

  const topicLabelMap = Object.fromEntries(topicLabels.map(label => [label.id, label.label]));

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const payload = await api.get('/mail/threads');
      setThreads(payload.threads || []);
    } catch (error) {
      console.error('Failed to load categorized threads', error);
      setThreads([]);
    } finally {
      setLoadingThreads(false);
    }
  };

  useEffect(() => {
    const loadPage = async () => {
      try {
        const [payload, rulesPayload] = await Promise.all([
          api.get('/settings/categorization'),
          api.get('/settings/email-rules'),
          loadThreads(),
        ]);
        if (payload.value) {
          setSettings(payload.value);
        }
        setEmailRules(rulesPayload.value || []);
      } catch (error) {
        console.error('Failed to load categorization settings', error);
      }
    };

    loadPage();
  }, []);

  const saveSettings = async () => {
    try {
      await Promise.all([
        api.put('/settings/categorization', settings),
        api.put('/settings/email-rules', emailRules),
      ]);
      toast({ title: 'Preferenze aggiornate' });
    } catch (error) {
      console.error('Failed to save categorization settings', error);
      toast({ title: 'Errore salvataggio', description: error.message, variant: 'destructive' });
    }
  };

  const reprocessMailbox = async () => {
    setProcessing(true);
    try {
      await api.put('/settings/categorization', settings);
      const payload = await api.post('/mail/categorize', {});
      await loadThreads();
      toast({
        title: 'Inbox rielaborata',
        description: `${payload.updatedThreads} thread rivalutati con le regole correnti.`,
      });
    } catch (error) {
      console.error('Failed to reprocess mailbox', error);
      toast({ title: 'Errore rielaborazione', description: error.message, variant: 'destructive' });
    } finally {
      setProcessing(false);
    }
  };

  const toggle = (path, key) => {
    setSettings(prev => ({
      ...prev,
      [path]: { ...prev[path], [key]: !prev[path][key] }
    }));
  };

  const saveEmailRules = async () => {
    setSavingRuleSet(true);
    try {
      await api.put('/settings/email-rules', emailRules);
      toast({ title: 'Regole inbox aggiornate' });
      await loadThreads();
    } catch (error) {
      toast({ title: 'Errore salvataggio regole', description: error.message, variant: 'destructive' });
    } finally {
      setSavingRuleSet(false);
    }
  };

  const updateRule = (ruleId, patch) => {
    setEmailRules(prev => prev.map(rule => rule.id === ruleId ? { ...rule, ...patch } : rule));
  };

  const addRule = () => {
    setEmailRules(prev => ([
      ...prev,
      {
        id: `rule-${Date.now()}`,
        name: 'Nuova regola',
        enabled: true,
        match: 'any',
        senders: [],
        domains: [],
        keywords: [],
        category: 'todo',
        inboxAction: 'keep_default',
      },
    ]));
  };

  const removeRule = (ruleId) => {
    setEmailRules(prev => prev.filter(rule => rule.id !== ruleId));
  };

  const relabelThread = async (threadId, category) => {
    setRelabelingThreadId(threadId);
    try {
      await api.post(`/mail/threads/${threadId}/relabel`, {
        category,
        reason: `Aggiornato manualmente dalla pagina Categorizzazione in ${category}.`,
      });
      await loadThreads();
      toast({ title: 'Thread aggiornato' });
    } catch (error) {
      toast({ title: 'Errore aggiornamento thread', description: error.message, variant: 'destructive' });
    } finally {
      setRelabelingThreadId('');
    }
  };

  const categoryLabels = {
    todo: 'Da fare',
    fyi: 'Per conoscenza',
    notification: 'Notifica',
    marketing: 'Marketing',
    followUp: 'Da seguire',
  };

  const categoryCounts = threads.reduce((accumulator, thread) => {
    const next = { ...accumulator };
    const category = thread.category || 'fyi';
    next[category] = (next[category] || 0) + 1;
    return next;
  }, { todo: 0, fyi: 0, notification: 0, marketing: 0, followUp: 0 });

  const topicCounts = Object.entries(
    threads.reduce((accumulator, thread) => {
      if (!thread.topic_label) {
        return accumulator;
      }

      return {
        ...accumulator,
        [thread.topic_label]: (accumulator[thread.topic_label] || 0) + 1,
      };
    }, {}),
  ).sort((left, right) => right[1] - left[1]);

  const categorizedThreads = threads.filter(thread => thread.categorized_at).length;
  const recentThreads = threads.slice(0, 5);
  const todoThreads = threads.filter((thread) => thread.category === 'todo').slice(0, 4);
  const inboxVisibleThreads = threads.filter((thread) => thread.inbox_action !== 'move_out').slice(0, 4);
  const hiddenThreads = threads.filter((thread) => thread.inbox_action === 'move_out').slice(0, 4);

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Categorizzazione</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={reprocessMailbox}
            disabled={processing}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 disabled:opacity-50"
          >
            {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Rielabora inbox
          </button>
          <button onClick={saveSettings} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
            Aggiorna preferenze
          </button>
        </div>
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
            <div className="col-span-2 bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Motore di categorizzazione privato</h3>
                  <p className="text-xs text-gray-500">
                    Le preferenze di questa pagina ora alimentano una rielaborazione server-side dei thread sincronizzati nel database locale.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: 'Thread importati', value: threads.length },
                    { label: 'Thread categorizzati', value: categorizedThreads },
                    { label: 'Da fare', value: categoryCounts.todo },
                    { label: 'Marketing', value: categoryCounts.marketing },
                  ].map(item => (
                    <div key={item.label} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 min-w-[132px]">
                      <div className="text-[11px] uppercase tracking-wide text-gray-400">{item.label}</div>
                      <div className="mt-1 text-2xl font-semibold text-gray-900">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-5 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Topic piu presenti</div>
                  {loadingThreads ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Caricamento thread...
                    </div>
                  ) : topicCounts.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {topicCounts.slice(0, 6).map(([topic, count]) => (
                        <span key={topic} className="rounded-full bg-brand/10 px-3 py-1 text-xs font-medium text-brand">
                          {topicLabelMap[topic] || topic} · {count}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Nessun topic ancora rilevato. Sincronizza una casella o rielabora i thread esistenti.
                    </div>
                  )}
                </div>

                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">Thread recenti</div>
                  {loadingThreads ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Caricamento classificazioni...
                    </div>
                  ) : recentThreads.length > 0 ? (
                    <div className="space-y-2.5">
                      {recentThreads.map(thread => (
                        <div key={thread.id} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-medium text-gray-900">{thread.subject}</div>
                            <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-600">
                              {categoryLabels[thread.category] || thread.category}
                            </span>
                            {thread.topic_label ? (
                              <span className="rounded-full bg-brand/10 px-2 py-1 text-[11px] font-medium text-brand">
                                {topicLabelMap[thread.topic_label] || thread.topic_label}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {thread.from_name} • {thread.inbox_action === 'move_out' ? 'Fuori inbox' : 'Visibile in inbox'}
                          </div>
                          <div className="mt-2 text-xs text-gray-600">
                            {thread.category_reason || 'In attesa di rielaborazione.'}
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <select
                              value={thread.category || 'fyi'}
                              onChange={(event) => relabelThread(thread.id, event.target.value)}
                              disabled={relabelingThreadId === thread.id}
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700"
                            >
                              {Object.entries(categoryLabels).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                              ))}
                            </select>
                            {thread.manual_override ? (
                              <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                                Override manuale
                              </span>
                            ) : null}
                            {thread.matched_rule_name ? (
                              <span className="rounded-full bg-sky-50 px-2 py-1 text-[11px] font-medium text-sky-700">
                                {thread.matched_rule_name}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500">
                      Nessun thread disponibile nel database locale.
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {[
                  {
                    title: 'Da rispondere oggi',
                    tone: 'bg-red-50 border-red-100',
                    badge: 'Todo',
                    items: todoThreads,
                  },
                  {
                    title: 'Visibili in inbox',
                    tone: 'bg-white border-gray-100',
                    badge: 'Inbox',
                    items: inboxVisibleThreads,
                  },
                  {
                    title: 'Fuori inbox',
                    tone: 'bg-slate-50 border-slate-100',
                    badge: 'Archived',
                    items: hiddenThreads,
                  },
                ].map((section) => (
                  <div key={section.title} className={`rounded-xl border p-4 ${section.tone}`}>
                    <div className="flex items-center justify-between gap-3 mb-3">
                      <div className="text-sm font-semibold text-gray-900">{section.title}</div>
                      <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-500">{section.badge}</span>
                    </div>
                    {section.items.length ? (
                      <div className="space-y-2">
                        {section.items.map((thread) => (
                          <div key={`${section.title}-${thread.id}`} className="rounded-lg border border-white/60 bg-white px-3 py-2">
                            <div className="text-xs font-medium text-gray-900 truncate">{thread.subject}</div>
                            <div className="mt-1 text-[11px] text-gray-500 truncate">{thread.from_name || thread.from_email}</div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-gray-400">Nessun thread in questa vista.</div>
                    )}
                  </div>
                ))}
              </div>
            </div>

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
              <p className="text-xs text-gray-500 mb-3">Scegli quali indirizzi, domini o parole chiave devono finire in una categoria precisa.</p>
              <div className="space-y-4">
                {emailRules.map(rule => (
                  <div key={rule.id} className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <input
                        value={rule.name}
                        onChange={(event) => updateRule(rule.id, { name: event.target.value })}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900"
                      />
                      <Toggle checked={rule.enabled !== false} onChange={(value) => updateRule(rule.id, { enabled: value })} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      <input
                        value={(rule.senders || []).join(', ')}
                        onChange={(event) => updateRule(rule.id, { senders: event.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
                        placeholder="Mittenti esatti, separati da virgola"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <input
                        value={(rule.domains || []).join(', ')}
                        onChange={(event) => updateRule(rule.id, { domains: event.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
                        placeholder="Domini, es. cliente.it"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      />
                      <input
                        value={(rule.keywords || []).join(', ')}
                        onChange={(event) => updateRule(rule.id, { keywords: event.target.value.split(',').map(item => item.trim()).filter(Boolean) })}
                        placeholder="Parole chiave in oggetto/snippet"
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm md:col-span-2"
                      />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <select
                        value={rule.match || 'any'}
                        onChange={(event) => updateRule(rule.id, { match: event.target.value })}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="any">Qualunque criterio</option>
                        <option value="all">Tutti i criteri</option>
                      </select>
                      <select
                        value={rule.category || 'todo'}
                        onChange={(event) => updateRule(rule.id, { category: event.target.value })}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        {Object.entries(categoryLabels).map(([value, label]) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <select
                        value={rule.inboxAction || 'keep_default'}
                        onChange={(event) => updateRule(rule.id, { inboxAction: event.target.value })}
                        className="rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      >
                        <option value="keep_default">Segui logica inbox</option>
                        <option value="keep_inbox">Tieni in inbox</option>
                        <option value="move_out">Togli da inbox</option>
                      </select>
                    </div>
                    <button
                      onClick={() => removeRule(rule.id)}
                      className="text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Elimina regola
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <button onClick={addRule} className="flex items-center gap-1.5 text-sm text-gray-700 hover:text-gray-900 font-medium">
                  + Aggiungi regola
                </button>
                <button
                  onClick={saveEmailRules}
                  disabled={savingRuleSet}
                  className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 disabled:opacity-50"
                >
                  {savingRuleSet ? 'Salvataggio...' : 'Salva regole'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
