import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, ArrowRight, Plus, X } from 'lucide-react';

const steps = [
  { id: 1, label: 'Connetti la inbox' },
  { id: 2, label: 'Connetti il calendario' },
  { id: 3, label: 'Setup inbox' },
  { id: 4, label: 'Scegli il piano' },
  { id: 5, label: 'Invita il team' },
];

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);
  const [emails, setEmails] = useState(['']);
  const [selectedPlan, setSelectedPlan] = useState('annual');

  const next = () => setCurrentStep(s => Math.min(s + 1, 6));

  return (
    <div className="min-h-screen bg-gray-100 font-inter">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <Link to="/" className="text-brand font-black text-xl">MailMind AI</Link>
        <button className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </header>

      <div className="flex min-h-[calc(100vh-57px)]">
        {/* Stepper sidebar */}
        <div className="w-48 p-6 flex flex-col gap-3">
          {steps.map((step, i) => {
            const done = currentStep > step.id;
            const active = currentStep === step.id;
            return (
              <div key={step.id} className="flex items-center gap-2">
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full border-2 transition-colors ${
                    done ? 'bg-brand border-brand' : active ? 'bg-brand border-brand' : 'bg-white border-gray-300'
                  }`} />
                  {i < steps.length - 1 && <div className="w-px h-8 bg-gray-200 mt-1" />}
                </div>
                <span className={`text-xs font-medium ${active ? 'text-gray-900' : done ? 'text-gray-500' : 'text-gray-400'}`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Main content */}
        <div className="flex-1 flex items-start justify-center pt-12 px-6">
          <div className="w-full max-w-md">
            {/* Step 1: Connect inbox */}
            {currentStep === 1 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-cream px-6 py-4 text-xs text-gray-500 text-center">
                  La tua inbox rimane sicura.
                </div>
                <div className="px-8 py-8 text-center">
                  <h2 className="text-2xl font-black text-gray-900 mb-2">Colleghiamo la tua inbox di lavoro.</h2>
                  <p className="text-gray-500 text-sm mb-8">MailMind AI organizza le email e scrive bozze senza mai inviare o eliminare nulla.</p>
                  <div className="flex justify-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-red-50 rounded-xl flex items-center justify-center text-2xl font-black text-red-500">M</div>
                    <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center text-2xl font-black text-blue-500">O</div>
                  </div>
                  <button
                    onClick={next}
                    className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors mb-3"
                  >
                    <span className="text-base">M</span>
                    Connetti la tua inbox Gmail
                  </button>
                  <button
                    onClick={next}
                    className="w-full text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2"
                  >
                    Connetti con Outlook
                  </button>
                  <p className="text-xs text-gray-400 mt-4">MailMind AI non invia mai email per tuo conto • Puoi disconnettere in qualsiasi momento</p>
                  <div className="flex justify-center gap-3 mt-4">
                    {['GDPR', 'HIPAA', 'ISO', 'SOC2'].map(c => (
                      <span key={c} className="text-[10px] font-bold text-gray-400 border border-gray-200 rounded px-2 py-0.5">{c}</span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Connect calendar */}
            {currentStep === 2 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="bg-cream px-6 py-4 text-xs text-gray-500 text-center">
                  Sei in, Utente
                </div>
                <div className="px-8 py-8 text-center">
                  <h2 className="text-2xl font-black text-gray-900 mb-2">Email connessa. Ora è il turno del calendario.</h2>
                  <p className="text-gray-500 text-sm mb-8">MailMind AI sincronizza il tuo calendario per suggerire la tua disponibilità nelle bozze che scrive.</p>
                  <div className="flex justify-center gap-4 mb-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center text-2xl font-black text-blue-500">31</div>
                    <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center text-2xl font-black text-blue-500">O</div>
                  </div>
                  <button
                    onClick={next}
                    className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors mb-3"
                  >
                    <span>📅</span>
                    Connetti Google Calendar
                  </button>
                  <button
                    onClick={next}
                    className="w-full text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors py-2"
                  >
                    Connetti con Outlook
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Inbox setup */}
            {currentStep === 3 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-8 py-8">
                  <h2 className="text-xl font-black text-gray-900 mb-2">Mantieni ciò che conta nella tua inbox</h2>
                  <p className="text-sm text-gray-500 mb-6">MailMind AI etichetta le email, mantiene le più importanti nella inbox e archivia il resto nelle cartelle MailMind.</p>
                  <div className="border border-dashed border-gray-200 rounded-xl p-4 mb-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-gray-600">Etichette</span>
                          <Plus className="w-3.5 h-3.5 text-gray-400" />
                        </div>
                        {[
                          { color: 'bg-red-400', label: '1: da fare' },
                          { color: 'bg-orange-400', label: '2: per conoscenza' },
                          { color: 'bg-green-400', label: '3: notifica' },
                          { color: 'bg-blue-400', label: '4: da seguire' },
                          { color: 'bg-pink-400', label: '5: marketing' },
                          { color: 'bg-indigo-400', label: '6: burocrazia' },
                        ].map(item => (
                          <div key={item.label} className="flex items-center gap-2 mb-1.5">
                            <div className={`w-3 h-3 rounded-full ${item.color}`} />
                            <span className="text-xs text-gray-700">{item.label}</span>
                          </div>
                        ))}
                      </div>
                      <div className="text-xs text-gray-500 space-y-1.5">
                        <div className="flex items-center gap-1.5"><span>📄</span> Note</div>
                        <div className="flex items-center gap-1.5"><span>📁</span> 1: da fare</div>
                        <div className="flex items-center gap-1.5"><span>📁</span> 2: per conoscenza</div>
                        <div className="flex items-center gap-1.5"><span>📁</span> 3: notifica</div>
                        <div className="flex items-center gap-1.5"><span>📁</span> 4: da seguire</div>
                        <div className="flex items-center gap-1.5"><span>📁</span> 5: marketing</div>
                        <div className="flex items-center gap-1.5"><span>🗄️</span> Archivio</div>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 mb-4">Puoi scegliere quali etichette vengono archiviate nelle impostazioni.</p>
                  <button
                    onClick={next}
                    className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors ml-auto"
                  >
                    Continua <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Step 4: Choose plan */}
            {currentStep === 4 && (
              <div className="w-full max-w-2xl">
                <div className="text-center mb-6">
                  <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">QUASI FATTO!</div>
                  <h2 className="text-2xl font-black text-gray-900">Quale piano fa per te?</h2>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { id: 'annual', label: 'Annuale', price: '€31/mese', badge: 'Più popolare', note: 'Risparmia €96 all\'anno', features: ['Inbox e calendari illimitati', 'Categorizzazione email', 'Bozze nel tuo stile', 'Notetaker riunioni con brand', 'Calendario team avanzato', 'Integrazione PEC', 'Chat supporto'] },
                    { id: 'monthly', label: 'Mensile', price: '€39/mese', badge: null, note: '', features: ['Inbox e calendari illimitati', 'Categorizzazione email', 'Bozze nel tuo stile', 'Notetaker riunioni con brand', 'Calendario team avanzato', 'Integrazione PEC', 'Chat supporto'] },
                  ].map(plan => (
                    <div
                      key={plan.id}
                      onClick={() => setSelectedPlan(plan.id)}
                      className={`bg-white rounded-2xl p-6 border-2 cursor-pointer transition-all ${selectedPlan === plan.id ? 'border-gray-900' : 'border-gray-200'}`}
                    >
                      {plan.badge && (
                        <div className="text-[10px] font-bold bg-gray-900 text-white rounded-full px-2 py-0.5 inline-block mb-2">
                          {plan.badge}
                        </div>
                      )}
                      <div className="text-lg font-bold text-gray-900 mb-1">{plan.label}</div>
                      <div className="text-2xl font-black text-gray-900 mb-1">{plan.price}</div>
                      <div className="text-xs font-semibold text-brand mb-4">{plan.note || 'GRATIS per 7 giorni'}</div>
                      <ul className="space-y-1.5 mb-6">
                        {plan.features.map(f => (
                          <li key={f} className="flex items-start gap-2 text-xs text-gray-600">
                            <Check className="w-3.5 h-3.5 text-brand flex-shrink-0 mt-0.5" />
                            {f}
                          </li>
                        ))}
                      </ul>
                      <button
                        onClick={next}
                        className={`w-full py-2.5 rounded-xl font-semibold text-sm transition-colors ${
                          selectedPlan === plan.id ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        Inizia la prova gratuita
                      </button>
                      <div className="text-center mt-2">
                        <span className="text-[10px] text-gray-400">Pagamento sicuro</span>
                        <span className="text-[10px] font-bold text-gray-500 ml-1">Stripe</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Step 5: Invite team */}
            {currentStep === 5 && (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
                <div className="flex gap-3 mb-6">
                  {emails.map((email, i) => (
                    <div key={i} className="flex-1 flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5">
                      <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">C</div>
                      <input
                        type="email"
                        value={email}
                        onChange={e => {
                          const newEmails = [...emails];
                          newEmails[i] = e.target.value;
                          setEmails(newEmails);
                        }}
                        placeholder="collega.cognome@azienda.it"
                        className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
                      />
                      {emails.length > 1 && (
                        <button onClick={() => setEmails(emails.filter((_, j) => j !== i))}>
                          <X className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => setEmails([...emails, ''])}
                  className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-6 transition-colors"
                >
                  <Plus className="w-4 h-4" /> Aggiungi un altro
                </button>
                <div className="bg-cream rounded-xl p-4 mb-6">
                  <h3 className="text-lg font-black text-gray-900 mb-1">Invita il tuo team</h3>
                  <p className="text-sm text-gray-600 mb-3">
                    Per ogni collega che inviti a MailMind AI, accrediteremo il tuo account con{' '}
                    <span className="text-brand font-semibold">7 giorni extra di prova.</span>
                  </p>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex items-center justify-between">
                      {['+7', '+14', '+21', '+28'].map(d => (
                        <div key={d} className="flex flex-col items-center">
                          <div className="w-3 h-3 rounded-full border-2 border-gray-300 bg-white" />
                          <span className="text-xs text-gray-500 mt-1">{d} giorni</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <button onClick={next} className="w-full bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors mb-3">
                  Continua
                </button>
                <button onClick={next} className="w-full text-sm text-gray-500 hover:text-gray-700 transition-colors">
                  Salta questo passaggio
                </button>
              </div>
            )}

            {/* Step 6: Done - inbox organized */}
            {currentStep === 6 && (
              <div className="space-y-4">
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                    <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                  </div>
                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-400" /> Da rispondere (1)</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-orange-400" /> Per conoscenza (1)</div>
                      <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-400" /> Notifica (2)</div>
                    </div>
                    {[
                      { from: 'Marco Ferrari', badge: 'Da rispondere', badgeColor: 'bg-red-100 text-red-700', subject: 'Feedback veloce sulle vendite' },
                      { from: 'Comune di Milano', badge: 'Burocrazia', badgeColor: 'bg-blue-100 text-blue-700', subject: 'Pratica protocollata n. 12345' },
                      { from: 'Lucia Esposito', badge: 'Per conoscenza', badgeColor: 'bg-orange-100 text-orange-700', subject: 'Invito: Riunione mercoledì' },
                      { from: 'La Feltrinelli', badge: 'Marketing', badgeColor: 'bg-pink-100 text-pink-700', subject: 'Offerta del giorno: -30% libri' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                        <input type="checkbox" className="rounded" />
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                        <span className="text-sm font-medium text-gray-700 w-28 truncate">{item.from}</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${item.badgeColor}`}>{item.badge}</span>
                        <span className="text-xs text-gray-500 truncate">{item.subject}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-2xl p-6 border border-gray-200">
                  <h3 className="text-xl font-black text-gray-900 mb-1">La tua inbox è organizzata</h3>
                  <p className="text-sm text-gray-500 mb-4">MailMind AI inizia organizzando le tue ultime 300 email. Ogni nuova email verrà organizzata automaticamente.</p>
                  <Link
                    to="/dashboard"
                    className="w-full block text-center bg-gray-900 text-white py-3.5 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors"
                  >
                    Vai alla Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}