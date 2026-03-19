import { useEffect, useState } from 'react';
import { Loader2, Trash2, Sparkles } from 'lucide-react';
import { api } from '@/api/privateApiClient';
import { useToast } from '@/components/ui/use-toast';

const providerPushStatusMeta = {
  synced: { label: 'Scritta sul provider', className: 'bg-green-50 text-green-700 border-green-200' },
  pending: { label: 'Push in attesa', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  push_failed: { label: 'Push fallita', className: 'bg-red-50 text-red-700 border-red-200' },
  local_only: { label: 'Solo locale', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

function StatusBadge({ status }) {
  const meta = providerPushStatusMeta[status];
  if (!meta) {
    return null;
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
    style={{ height: '22px', width: '40px' }}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const Counter = ({ value, onChange, min = 1, max = 30 }) => (
  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-2 w-48">
    <button
      onClick={() => onChange(Math.max(min, value - 1))}
      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 font-bold"
    >−</button>
    <span className="flex-1 text-center text-sm font-medium text-gray-900">{value} giorni</span>
    <button
      onClick={() => onChange(Math.min(max, value + 1))}
      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 font-bold"
    >+</button>
  </div>
);

export default function Bozze() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState({
    enableDrafts: true,
    unusedDraftsDays: 14,
    responseStyle: 'everything',
    draftVariants: 3,
    enableFollowUps: true,
    followUpDays: 3,
    customTone: false,
    customToneText: '',
    fontFamily: 'Gmail/Outlook default',
    fontSize: 0,
    fontColor: '#111111',
    includeSignature: true,
    defaultSignature: '',
    schedulingSignature: '',
    includeSchedulingLink: false,
    showThreadingGmail: false,
    showThreadingOutlook: false,
  });
  const [threads, setThreads] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loadingPipeline, setLoadingPipeline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [generatingKey, setGeneratingKey] = useState(null);
  const [pushingDraftId, setPushingDraftId] = useState(null);
  const [deletingDraftId, setDeletingDraftId] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [draftOptions, setDraftOptions] = useState(null);
  const [loadingDraftOptionsFor, setLoadingDraftOptionsFor] = useState(null);
  const { toast } = useToast();
  const eligibleThreads = threads.filter((thread) => thread.draft_eligible);
  const awaitingReplyThreads = threads.filter((thread) => thread.category === 'followUp' || thread.needs_reply);

  const loadDraftWorkspace = async () => {
    setLoadingPipeline(true);
    try {
      const [threadsPayload, draftsPayload] = await Promise.all([
        api.get('/mail/threads'),
        api.get('/drafts'),
      ]);
      setThreads(threadsPayload.threads || []);
      setDrafts(draftsPayload.drafts || []);
    } catch (error) {
      console.error('Failed to load mailbox pipeline', error);
    } finally {
      setLoadingPipeline(false);
    }
  };

  useEffect(() => {
    const loadPage = async () => {
      try {
        const [payload] = await Promise.all([
          api.get('/settings/drafts'),
          loadDraftWorkspace(),
        ]);
        if (payload?.value) {
          setSettings(payload.value);
        }
      } catch (error) {
        console.error('Failed to load draft settings', error);
      }
    };

    loadPage();
  }, []);

  const saveSettings = async () => {
    try {
      await api.put('/settings/drafts', settings);
      toast({ title: 'Preferenze aggiornate' });
    } catch (error) {
      console.error('Failed to save draft settings', error);
      toast({ title: 'Errore salvataggio', description: error.message, variant: 'destructive' });
    }
  };

  const syncMailbox = async () => {
    setSyncing(true);
    try {
      const payload = await api.post('/mail/sync', {});
      toast({
        title: 'Sincronizzazione completata',
        description: `${payload.processedThreads} thread, ${payload.processedMessages} messaggi importati e ${payload.categorizedThreads} thread categorizzati.`,
      });
      await loadDraftWorkspace();
    } catch (error) {
      console.error('Failed to sync mailbox', error);
      toast({ title: 'Errore sincronizzazione', description: error.message, variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const generateDrafts = async (threadId = null) => {
    const nextGeneratingKey = threadId || 'all';
    setGeneratingKey(nextGeneratingKey);
    try {
      const payload = await api.post('/drafts/generate', threadId ? { threadId } : {});
      const createdCount = threadId ? 1 : (payload.created || 0);
      const pushedCount = threadId
        ? (payload.draft?.provider_push_status === 'synced' ? 1 : 0)
        : (payload.pushed || 0);
      const failedPushes = threadId
        ? (payload.draft?.provider_push_status === 'push_failed' ? 1 : 0)
        : (payload.failedPushes || 0);
      toast({
        title: createdCount > 0 ? 'Bozze generate' : 'Nessuna nuova bozza',
        description: createdCount > 0
          ? `${createdCount} bozz${createdCount === 1 ? 'a creata' : 'e create'} nel backend privato${pushedCount > 0 ? ` • ${pushedCount} scritte su provider` : ''}${failedPushes > 0 ? ` • ${failedPushes} con errore push` : ''}.`
          : 'Sincronizza prima la casella o verifica se esistono email che richiedono risposta.',
      });
      await loadDraftWorkspace();
    } catch (error) {
      console.error('Failed to generate drafts', error);
      toast({ title: 'Errore generazione', description: error.message, variant: 'destructive' });
    } finally {
      setGeneratingKey(null);
    }
  };

  const loadDraftOptions = async (thread) => {
    setLoadingDraftOptionsFor(thread.id);
    try {
      const payload = await api.post('/drafts/options', { threadId: thread.id });
      setDraftOptions({
        thread,
        variants: payload.variants || [],
      });
    } catch (error) {
      console.error('Failed to load draft options', error);
      toast({ title: 'Errore varianti bozza', description: error.message, variant: 'destructive' });
    } finally {
      setLoadingDraftOptionsFor(null);
    }
  };

  const applyDraftOption = async (threadId, content) => {
    setGeneratingKey(threadId);
    try {
      await api.post('/drafts/generate', { threadId, customContent: content });
      setDraftOptions(null);
      toast({ title: 'Bozza salvata', description: 'La variante selezionata e stata inserita nella pipeline.' });
      await loadDraftWorkspace();
    } catch (error) {
      console.error('Failed to save selected draft option', error);
      toast({ title: 'Errore salvataggio variante', description: error.message, variant: 'destructive' });
    } finally {
      setGeneratingKey(null);
    }
  };

  const pushDraft = async (draftId) => {
    setPushingDraftId(draftId);
    try {
      const payload = await api.post(`/drafts/${draftId}/push`, {});
      toast({
        title: payload.draft?.provider_push_status === 'synced' ? 'Bozza scritta sul provider' : 'Bozza aggiornata',
        description: payload.draft?.provider_push_status === 'synced'
          ? 'La bozza e ora presente nella mailbox del provider collegato.'
          : 'La bozza e stata aggiornata nel backend privato.',
      });
      await loadDraftWorkspace();
    } catch (error) {
      toast({ title: 'Errore push provider', description: error.message, variant: 'destructive' });
      await loadDraftWorkspace();
    } finally {
      setPushingDraftId(null);
    }
  };

  const deleteDraft = async (draftId) => {
    const draft = drafts.find(item => item.id === draftId);
    if (!draft) {
      return;
    }

    const confirmed = window.confirm(
      draft.provider_push_status === 'synced'
        ? 'Questa bozza verra rimossa anche dal provider collegato. Continuare?'
        : 'Eliminare questa bozza locale?'
    );

    if (!confirmed) {
      return;
    }

    setDeletingDraftId(draftId);
    try {
      await api.delete(`/drafts/${draftId}`);
      toast({ title: 'Bozza eliminata' });
      await loadDraftWorkspace();
    } catch (error) {
      toast({ title: 'Errore eliminazione', description: error.message, variant: 'destructive' });
    } finally {
      setDeletingDraftId(null);
    }
  };

  return (
    <div className="h-full overflow-auto">
      {draftOptions ? (
        <div className="fixed inset-0 z-40 bg-black/30 p-6 flex items-center justify-center" onClick={() => setDraftOptions(null)}>
          <div className="max-w-4xl w-full max-h-[85vh] overflow-auto rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div>
                <h3 className="text-base font-semibold text-gray-900">Varianti bozza</h3>
                <p className="text-sm text-gray-500">{draftOptions.thread.subject}</p>
              </div>
              <button onClick={() => setDraftOptions(null)} className="text-sm text-gray-500 hover:text-gray-900">Chiudi</button>
            </div>
            <div className="grid gap-4 p-6 lg:grid-cols-3">
              {draftOptions.variants.map((variant, index) => (
                <div key={`${variant.label}-${index}`} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="mb-2">
                    <div className="text-sm font-semibold text-gray-900">{variant.label}</div>
                    <div className="text-xs text-gray-500">{variant.description}</div>
                  </div>
                  <pre className="min-h-[220px] whitespace-pre-wrap rounded-lg bg-white p-3 text-xs text-gray-700">{variant.content}</pre>
                  <button
                    onClick={() => applyDraftOption(draftOptions.thread.id, variant.content)}
                    disabled={generatingKey === draftOptions.thread.id}
                    className="mt-3 inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {generatingKey === draftOptions.thread.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    Usa questa variante
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Bozze</h1>
        <button onClick={saveSettings} className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium">
          Aggiorna preferenze
        </button>
      </div>

      <div className="px-6 pt-5">
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          {[
            { id: 'general', label: 'Generale' },
            { id: 'signatures', label: 'Firme' },
            { id: 'files', label: 'File personalizzati' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="max-w-4xl space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">Pipeline bozze privata</h3>
                  <p className="text-xs text-gray-500">
                    Sincronizza le caselle collegate, importa i thread nel database locale e genera risposte bozza persistenti.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={syncMailbox}
                    disabled={syncing}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 disabled:opacity-50"
                  >
                    {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Sincronizza casella
                  </button>
                  <button
                    onClick={() => generateDrafts()}
                    disabled={generatingKey === 'all'}
                    className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {generatingKey === 'all' ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Genera bozze
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Thread sincronizzati</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">{threads.length}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Thread candidati a bozza</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">{threads.filter(thread => thread.draft_eligible).length}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Bozze salvate</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">{drafts.length}</div>
                </div>
                <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="text-xs text-gray-500">Bozze scritte sul provider</div>
                  <div className="mt-1 text-2xl font-semibold text-gray-900">{drafts.filter(draft => draft.provider_push_status === 'synced').length}</div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-emerald-700">Bozze pronte</div>
                  <div className="mt-1 text-2xl font-semibold text-emerald-900">{drafts.filter((draft) => draft.provider_push_status === 'synced').length}</div>
                  <p className="mt-2 text-xs text-emerald-800">Gia' presenti su Gmail o Outlook, pronte per la revisione finale.</p>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-amber-700">Awaiting reply</div>
                  <div className="mt-1 text-2xl font-semibold text-amber-900">{awaitingReplyThreads.length}</div>
                  <p className="mt-2 text-xs text-amber-800">Thread che meritano follow-up o una seconda risposta operativa.</p>
                </div>
                <div className="rounded-xl border border-sky-100 bg-sky-50 p-4">
                  <div className="text-xs font-medium uppercase tracking-wide text-sky-700">Thread bozzabili</div>
                  <div className="mt-1 text-2xl font-semibold text-sky-900">{eligibleThreads.length}</div>
                  <p className="mt-2 text-xs text-sky-800">Email che hanno contesto sufficiente per una bozza pronta in un click.</p>
                </div>
              </div>
            </div>

            <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="bg-cream rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Bozze generate</h3>
                {loadingPipeline ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Caricamento pipeline...
                  </div>
                ) : drafts.length > 0 ? (
                  <div className="space-y-3">
                    {drafts.map(draft => (
                      <div key={draft.id} className="rounded-xl border border-gray-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{draft.subject}</div>
                            <div className="text-xs text-gray-500">
                              {draft.from_name} • {draft.from_email} • {draft.account_provider === 'google' ? 'Gmail' : draft.account_provider === 'microsoft' ? 'Outlook' : 'Provider'}
                            </div>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <StatusBadge status={draft.provider_push_status} />
                            </div>
                          </div>
                          <div className="text-right text-xs text-gray-400">
                            <div>{draft.tone}</div>
                            <div>{new Date(draft.updated_at).toLocaleString('it-IT')}</div>
                          </div>
                        </div>
                        <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-gray-50 p-3 text-xs text-gray-700">
                          {draft.content}
                        </pre>
                        {draft.provider_last_error ? (
                          <div className="mt-3 text-xs text-red-600">{draft.provider_last_error}</div>
                        ) : null}
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className="text-xs text-gray-400">
                            {draft.provider_pushed_at ? `Push provider ${new Date(draft.provider_pushed_at).toLocaleString('it-IT')}` : 'Non ancora scritta sul provider'}
                          </div>
                          <div className="flex items-center gap-2">
                            {draft.provider_push_status !== 'local_only' ? (
                              <button
                                onClick={() => pushDraft(draft.id)}
                                disabled={pushingDraftId === draft.id || deletingDraftId === draft.id}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-gray-300 disabled:opacity-50"
                              >
                                {pushingDraftId === draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                                {draft.provider_push_status === 'synced' ? 'Aggiorna provider' : 'Scrivi su provider'}
                              </button>
                            ) : null}
                            <button
                              onClick={() => deleteDraft(draft.id)}
                              disabled={deletingDraftId === draft.id || pushingDraftId === draft.id}
                              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:border-red-300 hover:text-red-600 disabled:opacity-50"
                            >
                              {deletingDraftId === draft.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              Elimina
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
                    Nessuna bozza ancora presente. Collega un account in Integrazioni, sincronizza la casella e genera le prime risposte.
                  </div>
                )}
              </div>

              <div className="bg-cream rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Thread recenti</h3>
                    <p className="text-xs text-gray-500">Usa questa coda come triage: prima i thread bozzabili, poi le email solo FYI.</p>
                  </div>
                  <span className="rounded-full bg-white px-2 py-1 text-[11px] font-medium text-gray-500">{threads.length} thread</span>
                </div>
                {loadingPipeline ? (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Caricamento thread...
                  </div>
                ) : threads.length > 0 ? (
                  <div className="space-y-3">
                    {[...eligibleThreads, ...threads.filter((thread) => !thread.draft_eligible)].slice(0, 8).map(thread => (
                      <div key={thread.id} className="rounded-xl border border-gray-100 bg-white p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{thread.subject}</div>
                            <div className="text-xs text-gray-500">
                              {thread.from_name} • {thread.account_email || 'account privato'}
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-1">
                            <span className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                              thread.needs_reply ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {thread.needs_reply ? 'Richiede risposta' : 'FYI'}
                            </span>
                            {thread.category ? (
                              <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600">
                                {thread.category}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="mt-2 text-xs text-gray-600">{thread.snippet}</p>
                        <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-gray-400">
                          <span>{thread.draft_eligible ? 'Bozza consigliata' : thread.draft_eligibility_reason || 'Nessuna bozza automatica'}</span>
                          {thread.matched_rule_name ? <span>• Regola {thread.matched_rule_name}</span> : null}
                          {thread.manual_override ? <span>• Override manuale</span> : null}
                        </div>
                        {thread.draft_eligible ? (
                          <div className="mt-3 flex flex-wrap items-center gap-3">
                            <button
                              onClick={() => generateDrafts(thread.id)}
                              disabled={generatingKey === thread.id}
                              className="inline-flex items-center gap-2 text-xs font-medium text-brand hover:text-brand/80 disabled:opacity-50"
                            >
                              {generatingKey === thread.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                              Genera bozza per questo thread
                            </button>
                            <button
                              onClick={() => loadDraftOptions(thread)}
                              disabled={loadingDraftOptionsFor === thread.id}
                              className="inline-flex items-center gap-2 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
                            >
                              {loadingDraftOptionsFor === thread.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                              Vedi varianti
                            </button>
                          </div>
                        ) : thread.needs_reply ? (
                          <div className="mt-3 text-xs text-gray-400">{thread.draft_eligibility_reason || 'Thread non idoneo per bozza automatica.'}</div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-6 text-sm text-gray-500">
                    Nessun thread importato nel database locale.
                  </div>
                )}
              </div>
            </div>

            {/* Draft settings */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Impostazioni Bozze</h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita risposte bozza</div>
                  <div className="text-xs text-brand">Genera automaticamente bozze di risposta per le email in arrivo</div>
                </div>
                <Toggle checked={settings.enableDrafts} onChange={v => setSettings(p => ({ ...p, enableDrafts: v }))} />
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs text-gray-500 mb-2">Le bozze non utilizzate vengono eliminate dopo</div>
                <Counter value={settings.unusedDraftsDays} onChange={v => setSettings(p => ({ ...p, unusedDraftsDays: v }))} />
              </div>
            </div>

            {/* Response style */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Stile di risposta</h3>
              <div className="text-xs text-gray-500 mb-2">Con quale frequenza rispondi?</div>
              <select
                value={settings.responseStyle}
                onChange={e => setSettings(p => ({ ...p, responseStyle: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="everything">Rispondo a quasi tutto, anche solo per educazione</option>
                <option value="important">Rispondo solo alle email importanti</option>
                <option value="minimal">Rispondo solo quando strettamente necessario</option>
              </select>
              <div className="mt-4">
                <div className="text-xs text-gray-500 mb-2">Quante varianti vuoi vedere per ogni thread?</div>
                <Counter value={settings.draftVariants} onChange={v => setSettings(p => ({ ...p, draftVariants: Math.min(3, Math.max(1, v)) }))} min={1} max={3} />
              </div>
            </div>

            {/* Follow-ups */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Follow-up</h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita bozze di follow-up</div>
                  <div className="text-xs text-brand">Crea automaticamente bozze di follow-up quando non hai ricevuto risposta</div>
                </div>
                <Toggle checked={settings.enableFollowUps} onChange={v => setSettings(p => ({ ...p, enableFollowUps: v }))} />
              </div>
              {settings.enableFollowUps && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-500 mb-2">Giorni prima del follow-up</div>
                  <Counter value={settings.followUpDays} onChange={v => setSettings(p => ({ ...p, followUpDays: v }))} max={14} />
                </div>
              )}
            </div>

            {/* Custom tone */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Tono personalizzato</h3>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita istruzioni personalizzate</div>
                  <div className="text-xs text-gray-500">Aggiungi istruzioni personalizzate per guidare la scrittura delle bozze</div>
                </div>
                <Toggle checked={settings.customTone} onChange={v => setSettings(p => ({ ...p, customTone: v }))} />
              </div>
              {settings.customTone && (
                <textarea
                  value={settings.customToneText}
                  onChange={e => setSettings(p => ({ ...p, customToneText: e.target.value }))}
                  placeholder="Es: Usa sempre il Lei formale. Chiudi con 'Cordiali saluti'. Non usare emoji."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none h-24"
                />
              )}
              <div className="mt-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Includi link di scheduling nelle bozze</div>
                  <div className="text-xs text-gray-500">Utile per email che propongono una call o chiedono disponibilita'.</div>
                </div>
                <Toggle checked={settings.includeSchedulingLink} onChange={v => setSettings(p => ({ ...p, includeSchedulingLink: v }))} />
              </div>
              {settings.includeSchedulingLink ? (
                <textarea
                  value={settings.schedulingSignature}
                  onChange={e => setSettings(p => ({ ...p, schedulingSignature: e.target.value }))}
                  placeholder="Es: Se ti e piu comodo, puoi prenotare direttamente qui: {{scheduling_link}}"
                  className="mt-3 w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none resize-none h-20"
                />
              ) : null}
            </div>

            {/* Font settings */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Impostazioni Font</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Famiglia font</label>
                  <div className="relative">
                    <select
                      value={settings.fontFamily}
                      onChange={e => setSettings(p => ({ ...p, fontFamily: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none appearance-none"
                    >
                      <option>Gmail/Outlook default</option>
                      <option>Arial</option>
                      <option>Georgia</option>
                      <option>Times New Roman</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Dimensione font</label>
                  <input
                    type="number"
                    value={settings.fontSize}
                    onChange={e => setSettings(p => ({ ...p, fontSize: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Imposta 0 per ereditare la dimensione dal tuo client email.</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Colore font</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.fontColor}
                      onChange={e => setSettings(p => ({ ...p, fontColor: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                    />
                    <input
                      type="text"
                      value={settings.fontColor}
                      onChange={e => setSettings(p => ({ ...p, fontColor: e.target.value }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Email threading */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Threading Email</h3>
              <p className="text-xs text-gray-500 mb-4">Per un funzionamento ottimale delle bozze, Gmail e Outlook devono raggruppare le email correlate in un thread.</p>
              <div className="space-y-2">
                <button
                  onClick={() => setSettings(p => ({ ...p, showThreadingGmail: !p.showThreadingGmail }))}
                  className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-gray-900 py-2 border-b border-gray-100"
                >
                  Come abilitare il threading in Gmail
                  <span>{settings.showThreadingGmail ? '▲' : '▼'}</span>
                </button>
                {settings.showThreadingGmail && (
                  <p className="text-xs text-gray-500 py-2">Vai su Gmail → Impostazioni → Visualizzazione conversazione → Abilita</p>
                )}
                <button
                  onClick={() => setSettings(p => ({ ...p, showThreadingOutlook: !p.showThreadingOutlook }))}
                  className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-gray-900 py-2"
                >
                  Come abilitare il threading in Outlook
                  <span>{settings.showThreadingOutlook ? '▲' : '▼'}</span>
                </button>
                {settings.showThreadingOutlook && (
                  <p className="text-xs text-gray-500 py-2">Vai su Outlook → Visualizza → Mostra come conversazioni → Abilita</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'signatures' && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Impostazioni Organizzazione</h3>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-gray-900">Includi firme email nelle bozze</div>
                  <div className="text-xs text-gray-500">Disabilita se la tua organizzazione aggiunge firme automaticamente</div>
                </div>
                <Toggle checked={settings.includeSignature} onChange={v => setSettings(p => ({ ...p, includeSignature: v }))} />
              </div>
              <p className="text-xs text-gray-400">Useremo prima la tua firma specifica per account. Se non ne hai una, useremo la firma predefinita.</p>
            </div>
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Firma predefinita</h3>
              <textarea
                value={settings.defaultSignature}
                onChange={e => setSettings(p => ({ ...p, defaultSignature: e.target.value }))}
                placeholder="Incolla qui la tua firma"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none h-28 resize-none"
              />
            </div>
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Firme specifiche per account</h3>
              <div className="text-xs text-brand mb-2">utente@gmail.com</div>
              <textarea
                placeholder="Incolla la firma qui"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none h-28 resize-none"
              />
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="max-w-2xl space-y-5 relative">
            {showUploadModal && (
              <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6" onClick={() => setShowUploadModal(false)}>
                <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Carica File via Email</h3>
                    <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Invia PDF, CSV o file Excel come allegati a{' '}
                    <span className="font-semibold text-brand">ai@mailmind.ai</span>{' '}
                    e scrivi semplicemente <em>upload</em> nel corpo. Li aggiungeremo automaticamente.
                  </p>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="w-full bg-brand text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-brand/90 transition-colors"
                  >
                    Capito
                  </button>
                </div>
              </div>
            )}

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Carica File</h3>
              <p className="text-xs text-gray-500 mb-4">Carica documenti che MailMind AI può usare come riferimento nelle bozze. Questo aiuta a creare risposte più accurate e personalizzate.</p>
              <div
                onClick={() => setShowUploadModal(true)}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors"
              >
                <div className="text-gray-400 text-2xl mb-2">📄</div>
                <div className="text-sm font-medium text-gray-700">Trascina i file qui</div>
                <div className="text-xs text-gray-400">oppure clicca per sfogliare • PDF, CSV • Max 10MB ciascuno</div>
                <button className="mt-2 text-sm text-brand font-medium hover:underline">Scegli file</button>
              </div>
            </div>

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">I tuoi file</h3>
              <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
                <div className="text-gray-300 text-3xl mb-2">📄</div>
                <div className="text-sm text-gray-500">Nessun file caricato</div>
                <div className="text-xs text-gray-400 mt-1">Carica documenti per aiutare MailMind AI a scrivere risposte migliori</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
