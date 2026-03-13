import { useState } from 'react';
import { Settings, ChevronDown, X, Mic, Video, Upload } from 'lucide-react';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
  >
    <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${checked ? 'left-5' : 'left-1'}`} />
  </button>
);

export default function Notetaker() {
  const [showRecordDropdown, setShowRecordDropdown] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState('general');
  const [autoJoin, setAutoJoin] = useState('all');
  const [ntSettings, setNtSettings] = useState({
    sendFailure: true, hideImage: true, sendPrereads: true, turnOffSharing: false,
  });
  const [videoUrl, setVideoUrl] = useState('');

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Notetaker</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(true)} className="p-2 hover:bg-gray-100 rounded-lg">
            <Settings className="w-4 h-4 text-gray-500" />
          </button>
          <div className="relative">
            <button
              onClick={() => setShowRecordDropdown(!showRecordDropdown)}
              className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand/90"
            >
              Registra riunione <ChevronDown className="w-4 h-4" />
            </button>
            {showRecordDropdown && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowRecordDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-100 rounded-xl shadow-xl z-40 min-w-48 overflow-hidden">
                  <button onClick={() => { setShowRecordDropdown(false); setShowRecordModal(true); }} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 w-full">
                    <Mic className="w-4 h-4 text-gray-400" /> Inizia a registrare ora
                  </button>
                  <button onClick={() => { setShowRecordDropdown(false); setShowVideoModal(true); }} className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 w-full">
                    <Video className="w-4 h-4 text-gray-400" /> Invita alla riunione
                  </button>
                  <button className="flex items-center gap-2 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 w-full">
                    <Upload className="w-4 h-4 text-gray-400" /> Carica registrazione
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-12 max-w-4xl">
        <p className="text-center text-sm font-medium text-brand mb-2">Incontra il tuo nuovo AI Notetaker</p>
        <h2 className="text-3xl font-black text-gray-900 text-center mb-10">Non scrivere mai più note di riunione</h2>

        <div className="grid md:grid-cols-2 gap-4 mb-12">
          <div onClick={() => setShowRecordModal(true)} className="bg-white border border-gray-100 rounded-2xl p-6 cursor-pointer hover:shadow-md transition-shadow">
            <div className="bg-[#f5f0e8] rounded-xl p-4 mb-4 flex items-center justify-center h-32">
              <div className="text-center">
                <div className="flex items-center gap-2 justify-center mb-2">
                  <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                  <span className="text-xs text-gray-500">00:24</span>
                  <span className="text-xs border border-gray-300 px-2 py-0.5 rounded text-gray-500">Stop</span>
                </div>
                <div className="flex items-end justify-center gap-0.5 h-8">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="w-1 bg-red-300 rounded-full" style={{ height: `${20 + Math.sin(i * 0.7) * 15}px` }} />
                  ))}
                </div>
                <div className="text-xs text-gray-400 mt-2">Ciao mondo</div>
              </div>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Registra riunioni in presenza</h3>
            <p className="text-xs text-brand mb-3">Clicca. Parla. Registra. Fatto. Trascritti e riassunti istantanei.</p>
            <button className="text-sm font-medium text-gray-700 flex items-center gap-1">Inizia →</button>
          </div>

          <div onClick={() => setShowVideoModal(true)} className="bg-white border border-gray-100 rounded-2xl p-6 cursor-pointer hover:shadow-md transition-shadow">
            <div className="bg-[#f5f0e8] rounded-xl mb-4 h-32 overflow-hidden relative">
              <img src="https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?w=400&q=80" className="w-full h-full object-cover" alt="" />
              <div className="absolute top-2 right-2 bg-white rounded-lg px-2 py-1 shadow text-xs font-bold text-brand">M</div>
            </div>
            <h3 className="font-bold text-gray-900 mb-1">Unisciti alle videochiamate</h3>
            <p className="text-xs text-brand mb-3">Lascia che MailMind AI si unisca alle tue riunioni per trascritti e riassunti istantanei.</p>
            <button className="text-sm font-medium text-gray-700 flex items-center gap-1">Inizia →</button>
          </div>
        </div>

        <div className="flex items-center justify-center gap-12 text-sm text-brand">
          <div className="flex flex-col items-center gap-1">
            <Mic className="w-5 h-5" />
            <span>Registra e riassumi riunioni</span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">💬</span>
            <span>Trova risposte con <span className="font-bold">Chat</span></span>
          </div>
          <div className="flex flex-col items-center gap-1">
            <span className="text-xl">📧</span>
            <span>Follow-up automatici</span>
          </div>
        </div>
      </div>

      {/* Record Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">Inizia a registrare ora</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Beta</span>
              </div>
              <button onClick={() => setShowRecordModal(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">MailMind AI userà il microfono del tuo dispositivo per registrare la tua riunione per un massimo di 2 ore.</p>
            <div className="space-y-3">
              <div>
                <div className="text-xs text-gray-500 mb-1 border border-gray-200 px-2 py-0.5 rounded inline-block">Link all'evento (opzionale)</div>
                <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1">
                  <option>Nuova riunione</option>
                </select>
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Titolo riunione (opzionale)</div>
                <input type="text" placeholder="Inserisci titolo riunione..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-1">Microfono predefinito</div>
                <div className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-400">Pronto per registrare</div>
              </div>
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <div className="text-sm font-medium text-red-600">Accesso al microfono richiesto</div>
                <div className="text-xs text-red-500">Consenti l'accesso al microfono nelle impostazioni del browser per registrare.</div>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button disabled className="bg-gray-200 text-gray-400 px-4 py-2 rounded-lg text-sm font-medium cursor-not-allowed">Inizia Registrazione</button>
            </div>
          </div>
        </div>
      )}

      {/* Video Modal */}
      {showVideoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-gray-900">Aggiungi alla videochiamata</h3>
                <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">Beta</span>
              </div>
              <button onClick={() => setShowVideoModal(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Invita il Notetaker MailMind AI alla tua riunione online per registrare e generare un riassunto e trascritto.</p>
            <div>
              <div className="text-xs text-gray-500 mb-1 border border-gray-200 px-2 py-0.5 rounded inline-block">URL Riunione</div>
              <input
                type="url"
                value={videoUrl}
                onChange={e => setVideoUrl(e.target.value)}
                placeholder="https://zoom.us/j/..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:border-brand outline-none"
              />
            </div>
            <div className="flex justify-end mt-4">
              <button className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold">Inizia registrazione</button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowSettings(false)} />
          <div className="fixed top-0 right-0 h-full w-96 bg-white border-l border-gray-200 shadow-2xl z-50 overflow-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-900">Impostazioni Notetaker</h3>
              <button onClick={() => setShowSettings(false)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <div className="flex border-b border-gray-100">
              {['general', 'prereads'].map(t => (
                <button key={t} onClick={() => setSettingsTab(t)} className={`flex-1 py-2 text-sm font-medium ${settingsTab === t ? 'bg-gray-100 text-gray-900' : 'text-gray-500'}`}>
                  {t === 'general' ? 'Generale' : 'Pre-letture'}
                </button>
              ))}
            </div>
            <div className="p-5 space-y-5">
              {settingsTab === 'general' ? (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Unisciti automaticamente</h4>
                    {['all', 'external', 'hosting', 'none'].map(opt => (
                      <label key={opt} className="flex items-center gap-2 py-1.5 cursor-pointer">
                        <input type="radio" checked={autoJoin === opt} onChange={() => setAutoJoin(opt)} className="accent-gray-900" />
                        <span className="text-sm text-gray-700">{{ all: 'Tutte le riunioni', external: 'Solo riunioni esterne', hosting: 'Riunioni che ospito', none: 'Nessuna' }[opt]}</span>
                      </label>
                    ))}
                    <p className="text-xs text-brand mt-2">MailMind AI si unirà a tutte le riunioni con un link riunione.</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Lingua trascrizione</h4>
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option>Rilevamento Lingua Automatico</option>
                      <option>Italiano</option>
                      <option>English</option>
                    </select>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Parole personalizzate</h4>
                    <p className="text-xs text-gray-500 mb-2">Migliora la precisione della trascrizione aggiungendo parole personalizzate.</p>
                    <button className="flex items-center gap-1 text-sm text-brand font-medium">+ Aggiungi parola personalizzata</button>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Invia riepilogo riunione a</h4>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Condividi automaticamente registrazioni</h4>
                    <button className="flex items-center gap-1 text-sm text-brand font-medium mb-4">+ Aggiungi email</button>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Invia email di errore</div>
                        <div className="text-xs text-gray-500">Ti invieremo un'email se non riusciamo a unirci alla riunione.</div>
                      </div>
                      <Toggle checked={ntSettings.sendFailure} onChange={v => setNtSettings(s => ({ ...s, sendFailure: v }))} />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Aspetto Notetaker</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Nascondi immagine notetaker nelle riunioni</div>
                        <div className="text-xs text-gray-500">Il notetaker apparirà senza avatar.</div>
                      </div>
                      <Toggle checked={ntSettings.hideImage} onChange={v => setNtSettings(s => ({ ...s, hideImage: v }))} />
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Conservazione Registrazioni</h4>
                    <div className="text-xs text-gray-500 mb-1">Auto-elimina registrazioni dopo</div>
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                      <option>Mantieni fino all'eliminazione manuale</option>
                      <option>30 giorni</option>
                      <option>90 giorni</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Email pre-lettura</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Invia email pre-lettura</div>
                        <div className="text-xs text-gray-500">MailMind AI creerà pre-letture riunione 15 minuti prima delle riunioni ricorrenti.</div>
                      </div>
                      <Toggle checked={ntSettings.sendPrereads} onChange={v => setNtSettings(s => ({ ...s, sendPrereads: v }))} />
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2">Condivisione pre-lettura</h4>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-medium text-gray-900">Disattiva condivisione pre-lettura</div>
                        <div className="text-xs text-brand">Impedisce a MailMind AI di mettere in CC i colleghi nelle email pre-lettura.</div>
                      </div>
                      <Toggle checked={ntSettings.turnOffSharing} onChange={v => setNtSettings(s => ({ ...s, turnOffSharing: v }))} />
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between">
              <button onClick={() => setShowSettings(false)} className="text-sm text-gray-500 hover:text-gray-700">Annulla</button>
              <button className="text-sm text-gray-400 cursor-not-allowed">Aggiorna preferenze</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}