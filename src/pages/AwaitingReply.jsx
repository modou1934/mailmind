import { useEffect, useMemo, useState } from 'react'
import { Loader2, Sparkles } from 'lucide-react'
import { api } from '@/api/privateApiClient'
import { useToast } from '@/components/ui/use-toast'

const bulkCategoryOptions = [
  { value: 'followUp', label: 'Da seguire' },
  { value: 'todo', label: 'Da fare' },
  { value: 'fyi', label: 'Per conoscenza' },
]

export default function AwaitingReply() {
  const [threads, setThreads] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [bulkCategory, setBulkCategory] = useState('followUp')
  const [processing, setProcessing] = useState(false)
  const { toast } = useToast()

  const loadThreads = async () => {
    setLoading(true)
    try {
      const payload = await api.get('/mail/awaiting-reply')
      setThreads(payload.threads || [])
      setSelectedIds([])
    } catch (error) {
      toast({ title: 'Errore caricamento', description: error.message, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadThreads()
  }, [])

  const selectedThreads = useMemo(
    () => threads.filter((thread) => selectedIds.includes(thread.id)),
    [threads, selectedIds],
  )

  const toggleThread = (threadId) => {
    setSelectedIds((prev) => prev.includes(threadId)
      ? prev.filter((id) => id !== threadId)
      : [...prev, threadId])
  }

  const toggleAll = () => {
    setSelectedIds((prev) => prev.length === threads.length ? [] : threads.map((thread) => thread.id))
  }

  const bulkRelabel = async () => {
    if (!selectedIds.length) {
      return
    }

    setProcessing(true)
    try {
      await Promise.all(selectedIds.map((threadId) => api.post(`/mail/threads/${threadId}/relabel`, {
        category: bulkCategory,
        reason: `Aggiornato in bulk dalla vista awaiting reply in ${bulkCategory}.`,
      })))
      toast({ title: 'Thread aggiornati', description: `${selectedIds.length} thread riclassificati.` })
      await loadThreads()
    } catch (error) {
      toast({ title: 'Errore aggiornamento bulk', description: error.message, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  const bulkGenerateFollowUps = async () => {
    if (!selectedIds.length) {
      return
    }

    setProcessing(true)
    try {
      await Promise.all(selectedIds.map((threadId) => api.post('/drafts/generate', { threadId })))
      toast({ title: 'Bozze follow-up create', description: `${selectedIds.length} thread inviati alla pipeline bozze.` })
    } catch (error) {
      toast({ title: 'Errore generazione follow-up', description: error.message, variant: 'destructive' })
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Awaiting reply</h1>
          <p className="text-sm text-gray-500">Segui in blocco i thread che meritano un promemoria o una seconda risposta.</p>
        </div>
        <button onClick={loadThreads} className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300">
          Aggiorna vista
        </button>
      </div>

      <div className="px-8 py-6 max-w-5xl space-y-5">
        <div className="bg-white rounded-xl border border-gray-100 p-5 flex flex-wrap items-center gap-3 justify-between">
          <div>
            <div className="text-xs uppercase tracking-wide text-gray-400">Coda follow-up</div>
            <div className="mt-1 text-3xl font-semibold text-gray-900">{threads.length}</div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={bulkCategory}
              onChange={(event) => setBulkCategory(event.target.value)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700"
            >
              {bulkCategoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <button
              onClick={bulkRelabel}
              disabled={!selectedIds.length || processing}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:border-gray-300 disabled:opacity-50"
            >
              Riclassifica selezionati
            </button>
            <button
              onClick={bulkGenerateFollowUps}
              disabled={!selectedIds.length || processing}
              className="inline-flex items-center gap-2 rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Genera bozze follow-up
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" />Caricamento thread...</div>
          ) : threads.length ? (
            <div className="space-y-3">
              <label className="inline-flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={selectedIds.length === threads.length} onChange={toggleAll} />
                Seleziona tutti
              </label>
              {threads.map((thread) => (
                <div key={thread.id} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                  <div className="flex items-start gap-3">
                    <input type="checkbox" checked={selectedIds.includes(thread.id)} onChange={() => toggleThread(thread.id)} className="mt-1" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{thread.subject}</div>
                          <div className="text-xs text-gray-500">{thread.from_name || thread.from_email} • {thread.account_email || 'account collegato'}</div>
                        </div>
                        <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                          {thread.waiting_days} giorni
                        </span>
                      </div>
                      <p className="mt-2 text-xs text-gray-600">{thread.snippet}</p>
                      <div className="mt-2 text-[11px] text-gray-400">Follow-up dovuto dal {new Date(thread.follow_up_due_at).toLocaleString('it-IT')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">Nessun thread in attesa di risposta.</div>
          )}
        </div>

        {selectedThreads.length ? (
          <div className="bg-white rounded-xl border border-gray-100 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Selezione corrente</h2>
            <div className="space-y-2">
              {selectedThreads.map((thread) => (
                <div key={thread.id} className="text-sm text-gray-700">{thread.subject}</div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
