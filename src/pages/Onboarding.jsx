import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, X, ArrowRight, Plus } from 'lucide-react';

const steps = ['Connetti inbox', 'Connetti calendario', 'Setup inbox', 'Scegli piano', 'Invita team', 'La tua inbox è organizzata', 'Le tue risposte', 'Note riunioni'];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const [emails, setEmails] = useState(['']);
  const [plan, setPlan] = useState('annual');

  const next = () => {
    if (step < steps.length - 1) setStep(s => s + 1);
    else navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-brand font-black text-xl">MailMind AI</span>
        <button className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        {/* Steps sidebar */}
        <div className="w-32 flex flex-col items-start px-6 py-8 gap-0 relative">
          {steps.slice(0, 6).map((s, i) => (
            <div key={i} className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-0">
                <div className={`w-3 h-3 rounded-full border-2 transition-all flex-shrink-0 ${i < step ? 'bg-brand border-brand' : i === step ? 'bg-brand border-brand' : 'bg-white border-gray-300'}`} />
              </div>
              {i < 5 && <div className={`w-0.5 h-8 ml-[5px] ${i < step ? 'bg-brand' : 'bg-gray-200'}`} />}
            </div>
          ))}
          {/* Step labels */}
          <div className="absolute left-12 top-8 space-y-0">
            {steps.slice(0, 6).map((s, i) => (
              <div key={i} className={`text-xs py-[14px] font-medium transition-colors ${i === step ? 'text-gray-900' : i < step ? 'text-brand' : 'text-gray-300'}`}>
                {s}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-center justify-center p-8">
          {step === 0 && (
            <div className="max-w-md w-full">
              <div className="bg-[#f5f0e8] rounded-xl px-4 py-2 text-sm text-gray-600 mb-6 text-center">La tua inbox rimane sicura.</div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">Collegare la tua inbox di lavoro.</h2>
              <p className="text-gray-500 mb-6">MailMind AI organizza le email e bozza risposte senza mai inviare o eliminare nulla.</p>
              <div className="flex justify-center gap-8 mb-6">
                <div className="text-5xl">✉️</div>
                <div className="text-5xl">📧</div>
              </div>
              <button onClick={next} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 mb-3">
                ✉️ Collega la tua inbox Gmail
              </button>
              <button onClick={next} className="w-full text-center text-sm text-brand font-medium hover:underline">
                Connetti con Outlook
              </button>
              <p className="text-center text-xs text-gray-400 mt-4">MailMind non invia email per tuo conto · Puoi disconnetterti in qualsiasi momento</p>
              <div className="flex justify-center gap-3 mt-4">
                {['🛡️', '🔒', '✅', '🇪🇺'].map((icon, i) => (
                  <span key={i} className="text-xl opacity-60">{icon}</span>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="max-w-md w-full">
              <div className="bg-[#f5f0e8] rounded-xl px-4 py-2 text-sm text-gray-600 mb-6 text-center">Sei dentro,</div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">La tua email è connessa. Il prossimo passo è il calendario.</h2>
              <p className="text-gray-500 mb-6">MailMind AI si sincronizza con il tuo calendario per suggerire la tua disponibilità nelle email che scrive.</p>
              <div className="flex justify-center gap-8 mb-6">
                <div className="text-5xl">📅</div>
                <div className="text-5xl">📧</div>
              </div>
              <button onClick={next} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 mb-3">
                📅 Collega il tuo calendario Google
              </button>
              <button onClick={next} className="w-full text-center text-sm text-brand font-medium hover:underline">Connetti con Outlook</button>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-lg w-full">
              <h2 className="text-2xl font-black text-gray-900 mb-2">Mantieni ciò che è importante nella tua inbox</h2>
              <p className="text-gray-500 mb-5">MailMind AI etichetta le tue email, mantiene le più importanti nella tua inbox e archivia il resto in cartelle MailMind.</p>
              <div className="bg-[#f5f0e8] rounded-xl p-4 mb-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2 text-xs font-semibold text-gray-700">
                      <span>Etichette</span><span className="text-brand cursor-pointer">+</span>
                    </div>
                    {[{ color: 'bg-red-400', label: '1: da fare' }, { color: 'bg-yellow-400', label: '2: per conoscenza' }, { color: 'bg-green-400', label: '3: notifica' }, { color: 'bg-blue-400', label: '4: follow-up' }, { color: 'bg-pink-300', label: '5: marketing' }].map(e => (
                      <div key={e.label} className="flex items-center gap-2 py-1">
                        <div className={`w-3 h-3 rounded-full ${e.color}`} />
                        <span className="text-xs text-gray-600">{e.label}</span>
                      </div>
                    ))}
                    <button className="text-xs text-gray-400 mt-1">↓ Altro</button>
                  </div>
                  <div className="bg-white rounded-lg p-3">
                    {['📝 Note', '📁 1: da fare', '📁 2: per conoscenza', '📁 3: notifica', '📁 4: follow-up', '📁 5: marketing', '📦 Archivio'].map(item => (
                      <div key={item} className="text-xs text-gray-600 py-0.5">{item}</div>
                    ))}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-4">Puoi scegliere quali etichette vengono archiviate nelle impostazioni.</p>
              <button onClick={next} className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800">
                Continua <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 3 && (
            <div className="max-w-lg w-full">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">QUASI CI SIAMO!</p>
              <h2 className="text-3xl font-black text-gray-900 mb-6">Quale piano fa per te?</h2>
              <div className="grid grid-cols-2 gap-4 mb-6">
                {[
                  { key: 'annual', label: 'Annuale', price: '€39/mese', badge: 'GRATIS per 14 giorni', popular: true },
                  { key: 'monthly', label: 'Mensile', price: '€49/mese', badge: 'GRATIS per 14 giorni', popular: false },
                ].map(p => (
                  <div key={p.key} onClick={() => setPlan(p.key)} className={`border-2 rounded-2xl p-5 cursor-pointer transition-all ${plan === p.key ? 'border-gray-900' : 'border-gray-200'}`}>
                    {p.popular && <div className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full inline-block mb-2">Più popolare</div>}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-900">{p.label}</span>
                      <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">{p.badge}</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 mb-3">{p.price}</div>
                    <div className="space-y-1.5">
                      {['Inbox e calendari illimitati', 'Ordinamento e categorizzazione email', 'Bozze nel tuo tono e lingua', 'Notetaker personalizzato', 'Integrazione PEC', 'Support chat'].map(f => (
                        <div key={f} className="flex gap-2 text-xs text-gray-600">
                          <Check className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          {f}
                        </div>
                      ))}
                    </div>
                    <button onClick={next} className={`w-full mt-4 py-2.5 rounded-xl font-semibold text-sm ${plan === p.key ? 'bg-gray-900 text-white' : 'border border-gray-200 text-gray-700'}`}>
                      Inizia prova gratuita
                    </button>
                    <div className="flex items-center justify-between mt-2">
                      <p className="text-xs text-gray-400">Pagamento sicuro. Cancella in qualsiasi momento.</p>
                      <span className="text-xs text-gray-400 font-medium">stripe</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="bg-[#f5f0e8] rounded-xl p-4 mb-5">
                <input type="email" className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="collega.cognome@outlook.com" />
                <button className="flex items-center gap-1 text-sm text-gray-600 mt-2 hover:text-gray-900">
                  <Plus className="w-4 h-4" /> Aggiungi un altro
                </button>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Invita il tuo team</h3>
              <p className="text-sm text-gray-500 mb-4">Per ogni collega che inviti a MailMind AI, accrediteremo il tuo account con <span className="text-brand font-medium">7 giorni extra di prova.</span></p>
              <div className="flex items-center gap-4 mb-5">
                {['+7 giorni', '+14 giorni', '+21 giorni', '+28 giorni'].map((d, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <div className={`w-3 h-3 rounded-full border-2 ${i === 0 ? 'bg-brand border-brand' : 'border-gray-300'}`} />
                    <span className="text-xs text-gray-500">{d}</span>
                  </div>
                ))}
              </div>
              <button onClick={next} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 mb-3">Continua</button>
              <button onClick={next} className="w-full text-center text-sm text-gray-500 hover:text-gray-700">Salta questo passaggio</button>
            </div>
          )}

          {step === 5 && (
            <div className="max-w-lg w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-5">
                <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="grid grid-cols-2 divide-x divide-gray-100 p-4 gap-4">
                  <div>
                    {[{ color: 'text-red-500', label: 'Da fare (1)', dot: 'bg-red-400' }, { color: 'text-yellow-500', label: 'Per conoscenza (1)', dot: 'bg-yellow-400' }, { color: 'text-green-500', label: 'Notifica (2)', dot: 'bg-green-400' }].map(e => (
                      <div key={e.label} className="flex items-center gap-2 py-1.5">
                        <div className={`w-3 h-3 rounded-full ${e.dot}`} />
                        <span className={`text-sm font-medium ${e.color}`}>{e.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="pl-4 space-y-1.5">
                    {[
                      { name: 'Marco P.', tag: 'da fare', tagColor: 'bg-red-100 text-red-700', sub: 'Feedback rapido sulle vend...' },
                      { name: 'Amazon', tag: 'Notifica', tagColor: 'bg-green-100 text-green-700', sub: 'Il tuo pacco è in consegna...' },
                      { name: 'Lucia S.', tag: 'per conoscenza', tagColor: 'bg-yellow-100 text-yellow-700', sub: 'Invito: Sync settimanale...' },
                      { name: 'Morning Brew', tag: 'Notifica', tagColor: 'bg-green-100 text-green-700', sub: '☕ Inizia la giornata' },
                    ].map((e, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <input type="checkbox" className="w-3 h-3" />
                        <span className="text-xs text-gray-700 font-medium">{e.name}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${e.tagColor}`}>{e.tag}</span>
                        <span className="text-xs text-gray-400 truncate">{e.sub}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">La tua inbox è organizzata</h3>
              <p className="text-sm text-gray-500 mb-4">MailMind AI parte organizzando le tue 300 email più recenti. Ogni nuova email verrà organizzata automaticamente.</p>
              <button onClick={next} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800">Continua</button>
            </div>
          )}

          {step === 6 && (
            <div className="max-w-md w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-5">
                <div className="flex items-center gap-1.5 px-4 py-2 bg-gray-50">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-800 leading-relaxed mb-4">Caro Marco,<br/><br/>Abbiamo completato l'analisi. I numeri della settimana scorsa mostrano una crescita del 4% e Rachele preparerà il deck per la presentazione di venerdì.<br/><br/>Cordiali saluti, <br/>Simone</p>
                  <button className="bg-blue-600 text-white px-4 py-1.5 rounded-full text-sm font-medium flex items-center gap-1">
                    Invia →
                  </button>
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Le tue risposte sono pre-scritte</h3>
              <p className="text-sm text-gray-500 mb-4">Quando ricevi un'email a cui rispondere, MailMind AI bozza una risposta accurata. Tu la rivedi e invii.</p>
              <button onClick={next} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800">Continua</button>
            </div>
          )}

          {step === 7 && (
            <div className="max-w-md w-full">
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden mb-5">
                <div className="bg-gray-800 aspect-video rounded-t-2xl flex items-center justify-center relative overflow-hidden">
                  <img src="https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=600&q=80" className="w-full h-full object-cover opacity-60" alt="" />
                  <div className="absolute right-4 top-4 bg-white rounded-xl p-3 shadow-lg max-w-xs">
                    <div className="text-xs font-bold text-gray-900 mb-1">MailMind AI prende Note</div>
                    <div className="text-xs text-gray-600">12:03 - Sunny: Dobbiamo focalizzarci su come allochiamo il tempo...</div>
                  </div>
                </div>
              </div>
              <h3 className="text-2xl font-black text-gray-900 mb-2">Anche le tue note di riunione</h3>
              <p className="text-sm text-gray-500 mb-4">Dopo ogni riunione troverai note azionabili nella tua inbox e un'email di follow-up pronta da inviare.</p>
              <button onClick={() => navigate('/dashboard')} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800">Esplora MailMind AI</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}