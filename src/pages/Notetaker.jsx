import { useEffect, useRef, useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { api } from '@/api/privateApiClient';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
    style={{ height: '22px', width: '40px' }}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

export default function Notetaker() {
  const uploadInputRef = useRef(null);
  const [recordModal, setRecordModal] = useState(false);
  const [joinModal, setJoinModal] = useState(false);
  const [settingsPanel, setSettingsPanel] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [recordDropdown, setRecordDropdown] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState([]);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [sessions, setSessions] = useState([]);
  const [recordTitle, setRecordTitle] = useState('');
  const [recordTranscript, setRecordTranscript] = useState('');
  const [joinTitle, setJoinTitle] = useState('');
  const [joinTranscript, setJoinTranscript] = useState('');
  const [submittingRecord, setSubmittingRecord] = useState(false);
  const [submittingJoin, setSubmittingJoin] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [feedbackTone, setFeedbackTone] = useState('success');

  const [settings, setSettings] = useState({
    autoJoin: 'all',
    language: 'it',
    sendFailureEmails: true,
    hideNotetakerImage: true,
    recordingRetention: 'manual',
    sendPrereads: true,
    disablePrereadSharing: false,
  });

  useEffect(() => {
    const loadState = async () => {
      try {
        const [settingsPayload, calendarPayload, sessionsPayload] = await Promise.all([
          api.get('/settings/notetaker'),
          api.get('/calendar/events?limit=12'),
          api.get('/notetaker/sessions'),
        ]);

        if (settingsPayload.value) {
          setSettings(settingsPayload.value);
        }
        setCalendarEvents(calendarPayload.events || []);
        setSessions(sessionsPayload.sessions || []);
      } catch (error) {
        console.error('Failed to load notetaker settings', error);
      }
    };

    loadState();
  }, []);

  const saveSettings = async () => {
    try {
      await api.put('/settings/notetaker', settings);
      setSettingsPanel(false);
    } catch (error) {
      console.error('Failed to save notetaker settings', error);
    }
  };

  const loadSessions = async () => {
    try {
      const payload = await api.get('/notetaker/sessions');
      setSessions(payload.sessions || []);
    } catch (error) {
      console.error('Failed to load notetaker sessions', error);
    }
  };

  const selectedCalendarEvent = calendarEvents.find((event) => event.id === selectedEventId) || null;

  const createRecordSession = async () => {
    setSubmittingRecord(true);
    setFeedbackMessage('');
    setFeedbackTone('success');
    try {
      const payload = await api.post('/notetaker/sessions/record', {
        calendarEventId: selectedEventId || '',
        title: recordTitle,
        meetingUrl: selectedCalendarEvent?.meeting_url || '',
        transcriptText: recordTranscript,
        language: settings.language,
      });
      await loadSessions();
      setFeedbackMessage(payload.session?.status === 'ready' ? 'Recap riunione generato' : 'Sessione di registrazione creata');
      setRecordModal(false);
      setRecordTitle('');
      setRecordTranscript('');
      setSelectedEventId('');
    } catch (error) {
      console.error('Failed to create record session', error);
      setFeedbackTone('error');
      setFeedbackMessage(error.message || 'Creazione sessione fallita');
    } finally {
      setSubmittingRecord(false);
    }
  };

  const createJoinSession = async () => {
    setSubmittingJoin(true);
    setFeedbackMessage('');
    setFeedbackTone('success');
    try {
      const payload = await api.post('/notetaker/sessions/join', {
        calendarEventId: selectedEventId || '',
        title: joinTitle,
        meetingUrl,
        transcriptText: joinTranscript,
        language: settings.language,
      });
      await loadSessions();
      setFeedbackMessage(payload.session?.status === 'ready' ? 'Recap videochiamata generato' : 'Sessione video creata');
      setJoinModal(false);
      setJoinTitle('');
      setJoinTranscript('');
      setMeetingUrl('');
      setSelectedEventId('');
    } catch (error) {
      console.error('Failed to create join session', error);
      setFeedbackTone('error');
      setFeedbackMessage(error.message || 'Creazione sessione fallita');
    } finally {
      setSubmittingJoin(false);
    }
  };

  const fileToBase64 = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const base64 = result.includes(',') ? result.split(',').at(-1) : result;
      resolve(base64 || '');
    };
    reader.onerror = () => reject(new Error('Impossibile leggere il file'));
    reader.readAsDataURL(file);
  });

  const uploadRecording = async (file) => {
    if (!file) {
      return;
    }

    setUploadingFile(true);
    setFeedbackMessage('');
    setFeedbackTone('success');
    try {
      const audioBase64 = await fileToBase64(file);
      const payload = await api.post('/notetaker/sessions/upload', {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type || 'application/octet-stream',
        audioBase64,
        language: settings.language,
      });
      await loadSessions();
      setFeedbackMessage(payload.session?.status === 'ready' ? 'Registrazione caricata e trascritta' : 'Registrazione caricata');
    } catch (error) {
      console.error('Failed to upload recording', error);
      setFeedbackTone('error');
      setFeedbackMessage(error.message || 'Upload registrazione fallito');
    } finally {
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
      setUploadingFile(false);
    }
  };

  return (
    <div className="h-full overflow-auto">
      <input
        ref={uploadInputRef}
        type="file"
        accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
        className="hidden"
        onChange={(event) => uploadRecording(event.target.files?.[0])}
      />
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Notetaker</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSettingsPanel(true)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <div className="relative">
            <button
              onClick={() => setRecordDropdown(!recordDropdown)}
              className="flex items-center gap-1.5 bg-brand text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
            >
              Registra riunione <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {recordDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setRecordDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 py-1 w-48">
                  <button
                    onClick={() => { setRecordModal(true); setRecordDropdown(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    🎙️ Inizia a registrare
                  </button>
                  <button
                    onClick={() => { setJoinModal(true); setRecordDropdown(false); }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    👤 Invita alla riunione
                  </button>
                  <button
                    onClick={() => {
                      setRecordDropdown(false);
                      uploadInputRef.current?.click();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    📤 {uploadingFile ? 'Caricamento...' : 'Carica registrazione'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-6 max-w-3xl">
        <div className="text-center mb-8">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Conosci il tuo nuovo AI Notetaker</div>
          <h2 className="text-2xl font-black text-gray-900">Non prendere più note nelle riunioni</h2>
        </div>

        {feedbackMessage && (
          <div className={`mb-4 rounded-xl px-4 py-3 text-sm ${
            feedbackTone === 'error'
              ? 'border border-red-200 bg-red-50 text-red-700'
              : 'border border-green-200 bg-green-50 text-green-700'
          }`}>
            {feedbackMessage}
          </div>
        )}

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Prossime riunioni rilevate</h3>
              <p className="text-xs text-gray-500">Il backend privato legge gli eventi dai calendari collegati e li prepara per il Notetaker.</p>
            </div>
            <span className="text-xs text-gray-400">{calendarEvents.length} eventi in finestra</span>
          </div>
          <div className="space-y-2">
            {calendarEvents.slice(0, 4).map(event => (
              <div key={event.id} className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-gray-900">{event.title}</div>
                  <div className="text-xs text-gray-500">{event.time_label} · {event.account_email || 'account collegato'}</div>
                </div>
                <div className="text-[11px] text-brand">{event.join_provider ? event.join_provider.replaceAll('_', ' ') : 'nessun link'}</div>
              </div>
            ))}
            {!calendarEvents.length && (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                Nessuna riunione trovata. Prima sincronizza Google Calendar o Outlook da Pianificazione.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between gap-4 mb-3">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Sessioni Notetaker recenti</h3>
              <p className="text-xs text-gray-500">Qui trovi recap, key points e action items generati dal backend privato.</p>
            </div>
            <span className="text-xs text-gray-400">{sessions.length} sessioni</span>
          </div>
          <div className="space-y-3">
            {sessions.slice(0, 5).map(session => (
              <div key={session.id} className="rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-4 mb-2">
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{session.title}</div>
                    <div className="text-xs text-gray-500">
                      {session.source_type === 'join' ? 'Videochiamata' : 'Registrazione'} · {session.join_provider ? session.join_provider.replaceAll('_', ' ') : 'manuale'}
                    </div>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    session.status === 'ready'
                      ? 'bg-green-100 text-green-700'
                      : session.status === 'processing'
                        ? 'bg-amber-100 text-amber-700'
                        : session.status === 'failed'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-gray-100 text-gray-600'
                  }`}>
                    {session.status}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  {session.summary_text || 'Sessione creata. Aggiungi un transcript per ottenere un recap completo.'}
                </p>
                {session.key_points?.length > 0 && (
                  <div className="mb-3">
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Key points</div>
                    <div className="space-y-1">
                      {session.key_points.slice(0, 3).map(point => (
                        <div key={point} className="text-sm text-gray-600">• {point}</div>
                      ))}
                    </div>
                  </div>
                )}
                {session.action_items?.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-400 mb-1">Action items</div>
                    <div className="space-y-1">
                      {session.action_items.slice(0, 3).map((item, index) => (
                        <div key={`${session.id}-${index}`} className="text-sm text-gray-600">
                          • <span className="font-medium text-gray-800">{item.owner || 'Da assegnare'}:</span> {item.task}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
            {!sessions.length && (
              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-4 text-sm text-gray-400">
                Nessuna sessione ancora creata. Usa i pulsanti qui sopra per avviare una registrazione o collegare una videochiamata.
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 mb-10">
          <div
            className="bg-cream rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-gray-300 transition-colors"
            onClick={() => setRecordModal(true)}
          >
            <div className="bg-white rounded-lg border border-gray-100 p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 rounded-full bg-red-400 animate-pulse" />
                <span className="text-xs font-mono text-gray-500">00:24</span>
                <div className="ml-auto bg-gray-100 rounded px-2 py-0.5 text-xs text-gray-600">Stop</div>
              </div>
              <div className="h-8 flex items-center gap-0.5">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-1 rounded-full bg-red-300"
                    style={{ height: `${Math.random() * 24 + 4}px` }}
                  />
                ))}
              </div>
              <div className="text-xs text-gray-400 mt-2">Ciao a tutti, oggi discutiamo...</div>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Registra riunioni in presenza</h3>
            <p className="text-xs text-brand mb-2">Clicca, parla, registra. Trascrizioni e sintesi istantanee.</p>
            <button className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              Inizia →
            </button>
          </div>

          <div
            className="bg-cream rounded-xl border border-gray-200 p-5 cursor-pointer hover:border-gray-300 transition-colors"
            onClick={() => setJoinModal(true)}
          >
            <div className="bg-white rounded-lg border border-gray-100 p-4 mb-4">
              <div className="relative">
                <div className="w-full h-20 bg-gray-800 rounded-lg" />
                <div className="absolute -top-1 -right-1 w-8 h-8 bg-brand rounded-full flex items-center justify-center text-white text-xs font-black">M</div>
                <div className="absolute top-2 right-2 bg-white rounded text-[9px] px-1.5 py-0.5 text-gray-700 font-medium leading-tight max-w-[100px]">
                  MailMind sta prendendo note...
                </div>
              </div>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Partecipa a videochiamate</h3>
            <p className="text-xs text-brand mb-2">Lascia che MailMind AI partecipi alle tue riunioni per trascrizioni e sintesi istantanee.</p>
            <button className="text-xs font-semibold text-gray-700 flex items-center gap-1">
              Inizia →
            </button>
          </div>
        </div>

        <div className="flex justify-around border-t border-gray-200 pt-6">
          {[
            { icon: '🎙️', label: 'Registra e sintetizza le riunioni' },
            { icon: '💬', label: 'Trova risposte istantaneamente con Chat' },
            { icon: '📧', label: 'Follow-up automatici' },
          ].map(item => (
            <div key={item.label} className="text-center max-w-[120px]">
              <div className="text-xl mb-1">{item.icon}</div>
              <div className="text-xs text-brand font-medium">{item.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Record modal */}
      {recordModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Inizia a registrare</h3>
                <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">Beta</span>
              </div>
              <button onClick={() => setRecordModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">MailMind AI userà il microfono del tuo dispositivo per registrare la riunione fino a 2 ore. Sintesi e trascrizione saranno generate al termine.</p>
            <div className="space-y-3 mb-5">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Collega a evento (opzionale)</label>
                <div className="relative">
                  <select
                    value={selectedEventId}
                    onChange={(event) => setSelectedEventId(event.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white appearance-none focus:outline-none"
                  >
                    <option value="">Nuova riunione</option>
                    {calendarEvents.map(event => (
                      <option key={event.id} value={event.id}>
                        {event.title} · {event.time_label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Titolo riunione (opzionale)</label>
                <input
                  type="text"
                  value={recordTitle}
                  onChange={event => setRecordTitle(event.target.value)}
                  placeholder="Inserisci il titolo..."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Transcript o note (opzionale)</label>
                <textarea
                  value={recordTranscript}
                  onChange={event => setRecordTranscript(event.target.value)}
                  placeholder="Incolla note rapide o un transcript per ottenere subito summary e action items..."
                  className="min-h-28 w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Microfono predefinito</label>
                <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2.5">
                  <span className="text-gray-400">🎙️</span>
                  <span className="text-sm text-gray-500">Pronto per registrare</span>
                </div>
              </div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
              <div className="text-xs font-semibold text-red-700 mb-0.5">Accesso al microfono richiesto</div>
              <div className="text-xs text-red-600">Finche non colleghiamo la cattura audio browser-side, puoi creare la sessione e aggiungere note o transcript manuali.</div>
            </div>
            <button
              onClick={createRecordSession}
              disabled={submittingRecord}
              className="w-full bg-brand text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand/90 transition-colors disabled:cursor-wait disabled:opacity-70"
            >
              {submittingRecord ? 'Creazione in corso...' : 'Crea sessione'}
            </button>
          </div>
        </div>
      )}

      {/* Join video call modal */}
      {joinModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-gray-900">Aggiungi alla videochiamata</h3>
                <span className="text-[10px] bg-gray-100 text-gray-600 rounded-full px-2 py-0.5 font-medium">Beta</span>
              </div>
              <button onClick={() => setJoinModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-4">Invita il Notetaker AI di MailMind alla tua riunione online per registrare e generare sintesi e trascrizioni.</p>
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Evento collegato (opzionale)</label>
              <select
                value={selectedEventId}
                onChange={(event) => {
                  setSelectedEventId(event.target.value);
                  const selected = calendarEvents.find((item) => item.id === event.target.value);
                  if (selected?.meeting_url) {
                    setMeetingUrl(selected.meeting_url);
                  }
                  if (selected?.title && !joinTitle) {
                    setJoinTitle(selected.title);
                  }
                }}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white appearance-none focus:outline-none"
              >
                <option value="">Nessun evento collegato</option>
                {calendarEvents.map(event => (
                  <option key={event.id} value={event.id}>
                    {event.title} · {event.time_label}
                  </option>
                ))}
              </select>
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Titolo riunione (opzionale)</label>
              <input
                type="text"
                value={joinTitle}
                onChange={event => setJoinTitle(event.target.value)}
                placeholder="Titolo della chiamata"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">URL riunione</label>
              <input
                type="url"
                value={meetingUrl}
                onChange={e => setMeetingUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Transcript o note (opzionale)</label>
              <textarea
                value={joinTranscript}
                onChange={event => setJoinTranscript(event.target.value)}
                placeholder="Se hai gia note o verbale, incollali qui per generare subito recap e action items."
                className="min-h-28 w-full resize-y rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
            <button
              onClick={createJoinSession}
              disabled={submittingJoin || (!meetingUrl.trim() && !selectedEventId)}
              className="w-full bg-brand text-white py-3 rounded-xl font-semibold text-sm hover:bg-brand/90 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submittingJoin ? 'Creazione in corso...' : 'Crea sessione video'}
            </button>
          </div>
        </div>
      )}

      {/* Settings panel */}
      {settingsPanel && (
        <>
          <div className="fixed inset-0 bg-black/30 z-40" onClick={() => setSettingsPanel(false)} />
          <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white">
              <span className="font-semibold text-gray-900">Impostazioni Notetaker</span>
              <button onClick={() => setSettingsPanel(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex border-b border-gray-100 px-4">
              {['general', 'prereads'].map(t => (
                <button
                  key={t}
                  onClick={() => setSettingsTab(t)}
                  className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${settingsTab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500'}`}
                >
                  {t === 'general' ? 'Generale' : 'Pre-letture'}
                </button>
              ))}
            </div>

            <div className="p-5 space-y-5 flex-1">
              {settingsTab === 'general' && (
                <>
                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-3">Partecipa automaticamente</h4>
                    <div className="space-y-2">
                      {['all', 'external', 'hosting', 'none'].map(opt => (
                        <label key={opt} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="autoJoin"
                            checked={settings.autoJoin === opt}
                            onChange={() => setSettings(p => ({ ...p, autoJoin: opt }))}
                            className="text-brand"
                          />
                          <span className="text-sm text-gray-700">
                            {{ all: 'Tutte le riunioni', external: 'Solo riunioni esterne', hosting: 'Riunioni che ospito', none: 'Nessuna' }[opt]}
                          </span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-brand mt-2">MailMind AI parteciperà a tutte le riunioni con un link.</p>
                  </div>

                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">Lingua trascrizione</h4>
                    <select
                      value={settings.language}
                      onChange={e => setSettings(p => ({ ...p, language: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                    >
                      <option value="auto">Rilevamento automatico lingua</option>
                      <option value="it">Italiano</option>
                      <option value="en">Inglese</option>
                    </select>
                  </div>

                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">Parole personalizzate</h4>
                    <p className="text-xs text-gray-500 mb-2">Migliora l'accuratezza della trascrizione aggiungendo parole personalizzate (nomi aziendali, termini tecnici, acronimi).</p>
                    <button className="flex items-center gap-1.5 text-sm text-brand font-medium">+ Aggiungi parola</button>
                  </div>

                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">Condivisione automatica registrazioni</h4>
                    <p className="text-xs text-gray-500 mb-2">Le email aggiunte qui saranno automaticamente invitate alle tue registrazioni.</p>
                    <button className="flex items-center gap-1.5 text-sm text-brand font-medium">+ Aggiungi email</button>
                  </div>

                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Invia email di errore</div>
                        <div className="text-xs text-gray-500">Ti invieremo un'email se non riusciamo a partecipare alla riunione.</div>
                      </div>
                      <Toggle checked={settings.sendFailureEmails} onChange={v => setSettings(p => ({ ...p, sendFailureEmails: v }))} />
                    </div>
                  </div>

                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-3">Aspetto Notetaker</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Nascondi immagine notetaker nelle riunioni</div>
                        <div className="text-xs text-gray-500">Il notetaker apparirà senza avatar o immagine del profilo</div>
                      </div>
                      <Toggle checked={settings.hideNotetakerImage} onChange={v => setSettings(p => ({ ...p, hideNotetakerImage: v }))} />
                    </div>
                  </div>

                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-2">Conservazione registrazioni</h4>
                    <select
                      value={settings.recordingRetention}
                      onChange={e => setSettings(p => ({ ...p, recordingRetention: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none"
                    >
                      <option value="manual">Conserva fino all'eliminazione manuale</option>
                      <option value="30">Elimina dopo 30 giorni</option>
                      <option value="90">Elimina dopo 90 giorni</option>
                    </select>
                    <p className="text-xs text-gray-400 mt-1">Lascia "Conserva fino all'eliminazione manuale" per conservare le registrazioni indefinitamente.</p>
                  </div>
                </>
              )}

              {settingsTab === 'prereads' && (
                <>
                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-3">Email di pre-lettura</h4>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-900">Invia email di pre-lettura</div>
                      <Toggle checked={settings.sendPrereads} onChange={v => setSettings(p => ({ ...p, sendPrereads: v }))} />
                    </div>
                    <p className="text-xs text-gray-500">MailMind AI creerà pre-letture 15 minuti prima delle riunioni ricorrenti già registrate in precedenza.</p>
                  </div>
                  <div className="bg-cream rounded-xl border border-gray-200 p-4">
                    <h4 className="text-xs font-semibold text-gray-900 mb-3">Condivisione pre-lettura</h4>
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-900">Disabilita condivisione pre-lettura</div>
                      <Toggle checked={settings.disablePrereadSharing} onChange={v => setSettings(p => ({ ...p, disablePrereadSharing: v }))} />
                    </div>
                    <p className="text-xs text-gray-500">Impedisce a MailMind AI di mettere in CC i colleghi idonei sulle email di pre-lettura.</p>
                  </div>
                </>
              )}
            </div>

            <div className="flex justify-between px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
              <button onClick={() => setSettingsPanel(false)} className="text-sm text-gray-500 hover:text-gray-700">Annulla</button>
              <button
                onClick={saveSettings}
                className="bg-brand/10 text-brand text-sm font-semibold px-4 py-1.5 rounded-lg hover:bg-brand/20 transition-colors"
              >
                Aggiorna preferenze
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
