import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Check, Star, Shield, Zap, ArrowRight, Play } from 'lucide-react';

const EmailMockup = ({ type }) => {
  if (type === 'triage') return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-auto text-xs text-gray-400">Inbox</span>
      </div>
      {[
        { name: 'Sara Conti', sub: 'Revisione Budget Q4', tag: 'Da Rispondere', tagColor: 'bg-red-100 text-red-700', time: '14:34' },
        { name: 'Luca Martini', sub: 'Riunione Domani alle 14', tag: 'Aggiornamento', tagColor: 'bg-blue-100 text-blue-700', time: '13:15' },
        { name: 'Studio Legale', sub: 'Revisione Contratto', tag: 'Per Conoscenza', tagColor: 'bg-yellow-100 text-yellow-700', time: '11:42' },
      ].map((e, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50">
          <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold flex-shrink-0">{e.name[0]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{e.name}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.tagColor}`}>{e.tag}</span>
            </div>
            <div className="text-xs text-gray-500 truncate mt-0.5">{e.sub}</div>
          </div>
          <span className="text-xs text-gray-400 flex-shrink-0">{e.time}</span>
        </div>
      ))}
    </div>
  );

  if (type === 'draft') return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-auto text-xs text-gray-400">Inbox</span>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-xs font-bold">M</div>
          <div>
            <div className="text-sm font-semibold text-gray-900">Marco Ferretti</div>
            <div className="text-xs text-gray-500">Opportunità di Partnership</div>
          </div>
          <span className="ml-auto text-xs text-gray-400">10:23</span>
        </div>
        <p className="text-xs text-gray-500 mb-3">Salve, vorrei discutere una potenziale collaborazione tra le nostre aziende...</p>
        <div className="bg-blue-50 rounded-lg p-3 border border-blue-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-blue-600">Bozza AI</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">✦ Nel tuo stile</span>
          </div>
          <p className="text-xs text-gray-700 leading-relaxed">Gentile Marco, la ringrazio per il suo interesse. Ho esaminato la proposta e sono molto interessato ad approfondire la collaborazione. Le propongo un incontro la prossima settimana...</p>
        </div>
      </div>
    </div>
  );

  if (type === 'meeting') return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100">
        <div className="w-3 h-3 rounded-full bg-red-400" />
        <div className="w-3 h-3 rounded-full bg-yellow-400" />
        <div className="w-3 h-3 rounded-full bg-green-400" />
        <span className="ml-auto text-xs text-gray-400">Inbox</span>
      </div>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold">M</div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900">MailMind AI</div>
            <div className="text-xs text-gray-500">Note Riunione: Roadmap Prodotto</div>
          </div>
          <span className="text-xs text-gray-400">Adesso</span>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600 space-y-1.5">
          <div className="font-semibold text-gray-700 mb-2">Riepilogo · 45 min</div>
          {['Discussa roadmap Q1 e priorità feature', 'Sara invia mockup venerdì EOD', 'Budget approvato per nuove assunzioni', 'Prossimo sync: martedì 14:00'].map((item, i) => (
            <div key={i} className="flex gap-2"><span className="text-brand">·</span>{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
};

const features = [
  {
    emoji: '🏷️',
    title: 'Organizziamo la tua inbox',
    desc: 'Ogni email automaticamente organizzata in etichette azionabili. Spam e rumore filtrati, vedi solo ciò che conta.',
    type: 'triage'
  },
  {
    emoji: '✍️',
    title: 'Scriviamo nel tuo stile',
    desc: 'Risposte pre-scritte nel tuo tono, pronte da inviare. Rivedi, modifica se necessario, e invia.',
    type: 'draft'
  },
  {
    emoji: '🎙️',
    title: 'Siamo in ogni riunione',
    desc: 'Note di riunione consegnate nella tua inbox istantaneamente. Email di follow-up bozze e pronte.',
    type: 'meeting'
  },
];

const testimonials = [
  { name: 'Alessandro Rossi', role: 'CEO @ TechMilano', text: '"MailMind AI ha rivoluzionato il mio workflow. Risparmio 1,5 ore al giorno solo sulla gestione email. La gestione della PEC integrata è straordinaria."', rating: 5 },
  { name: 'Francesca Bianchi', role: 'Avvocata, Studio Bianchi & Associati', text: '"Finalmente uno strumento che capisce il registro formale italiano. Le comunicazioni con la PA sono perfette — sa esattamente quando usare "Distinti saluti"."', rating: 5 },
  { name: 'Marco Verdi', role: 'Direttore Commerciale, PMI', text: '"Ho provato Fyxer ma non capiva l\'italiano vero. MailMind AI invece parla la nostra lingua, nel senso letterale. ROI in 2 settimane."', rating: 5 },
  { name: 'Giovanna Esposito', role: 'Commercialista', text: '"Durante la stagione fiscale gestisco centinaia di email. MailMind AI le categorizza perfettamente e le bozze sono sempre nel tono giusto con i clienti."', rating: 5 },
  { name: 'Roberto Conti', role: 'Account Manager B2B', text: '"La feature di trascrizione riunioni con Deepgram italiano è eccezionale. Nessun altro tool capisce gli accenti regionali come questo."', rating: 5 },
];

const pricingPlans = [
  {
    name: 'Solo',
    desc: 'Per freelance e consulenti',
    price: '€19',
    priceMonthly: '€24',
    features: ['200 bozze/mese', 'Triage semantico inbox', 'Registro formale italiano', 'Supporto email'],
    cta: 'Inizia gratis',
    popular: false,
  },
  {
    name: 'Pro',
    desc: 'Per manager e imprenditori',
    price: '€39',
    priceMonthly: '€49',
    features: ['Bozze illimitate', 'Integrazione PEC nativa', 'Template PA italiani', '5 ore notetaker/mese', 'Gmail + Outlook', 'Chat storico email', 'Email + chat support'],
    cta: 'Inizia gratis',
    popular: true,
  },
  {
    name: 'Studio / Team',
    desc: 'Per studi professionali e PMI',
    price: 'Contattaci',
    features: ['Tutto di Pro +', 'Multi-account PEC', 'Template personalizzabili', '20 ore notetaker/mese', 'Dashboard team', 'Onboarding dedicato', 'Supporto prioritario'],
    cta: 'Parla con noi',
    popular: false,
    enterprise: true,
  },
];

export default function Home() {
  const [annual, setAnnual] = useState(true);
  const [activeFeature, setActiveFeature] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setActiveFeature(p => (p + 1) % features.length), 4000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 flex items-center h-14 gap-6">
          <Link to="/" className="text-brand font-black text-xl tracking-tight flex-shrink-0">MailMind AI</Link>
          <div className="hidden md:flex items-center gap-5 text-sm text-gray-600">
            <a href="#pricing" className="hover:text-gray-900 transition-colors">Prezzi</a>
            <a href="#security" className="hover:text-gray-900 transition-colors">Sicurezza</a>
            <button className="flex items-center gap-1 hover:text-gray-900 transition-colors">Per Team <ChevronDown className="w-3 h-3" /></button>
            <a href="#" className="hover:text-gray-900 transition-colors">Blog</a>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Accedi</Link>
            <button className="text-sm border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">Parla con noi</button>
            <span className="text-sm text-gray-400">Inizia gratis:</span>
            <Link to="/onboarding" className="flex items-center gap-1.5 bg-gray-900 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              <span className="text-base">✉️</span> Gmail
            </Link>
            <Link to="/onboarding" className="flex items-center gap-1.5 border border-gray-200 text-sm px-3 py-1.5 rounded-lg hover:bg-gray-50 transition-colors">
              <span className="text-base">📧</span> Outlook
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="bg-[#f5f0e8] pt-16 pb-0">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-white rounded-full px-4 py-1.5 text-sm text-gray-700 mb-8 shadow-sm border border-gray-100">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            Unisciti a 10.000+ professionisti italiani
          </div>
          <h1 className="text-5xl md:text-7xl font-black text-gray-900 leading-tight mb-4">
            Il tuo assistente per
          </h1>
          <h1 className="text-5xl md:text-7xl font-black text-brand leading-tight mb-8">
            scrivere email
          </h1>
          <div className="flex items-center justify-center gap-3 mb-3">
            <Link to="/onboarding" className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg">
              ✉️ Inizia con Gmail
            </Link>
            <Link to="/onboarding" className="flex items-center gap-2 border-2 border-gray-200 bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50 transition-all">
              📧 Inizia con Outlook
            </Link>
          </div>
          <p className="text-sm text-gray-500 mb-8">14 giorni gratis · Cancella in qualsiasi momento</p>
          <button className="flex items-center gap-2 mx-auto border border-gray-200 bg-white text-gray-700 px-5 py-2 rounded-full text-sm hover:bg-gray-50 transition-colors shadow-sm">
            <span className="w-2 h-2 bg-green-400 rounded-full"></span>
            Parla con noi
          </button>
        </div>

        {/* Hero mockup */}
        <div className="max-w-3xl mx-auto px-6 mt-12">
          <div className="relative">
            <div className="bg-white rounded-t-2xl shadow-2xl border border-gray-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-yellow-400" />
                <div className="w-3 h-3 rounded-full bg-green-400" />
                <span className="ml-4 text-sm font-medium text-gray-700">Inbox</span>
                <span className="ml-auto text-xs text-gray-400 flex items-center gap-1">📧 Outlook</span>
              </div>
              {[
                { name: 'Sara Conti', tag: 'Da Rispondere', tagColor: 'bg-red-100 text-red-700', sub: 'Re: Revisione Budget Q4', preview: 'Ciao team, volevo fare un follow-up sulla nostra discussione sull\'allocazione...', draft: 'AI in bozza...', time: '' },
                { name: 'Luca Martini', tag: 'Aggiornamento Riunione', tagColor: 'bg-blue-100 text-blue-700', sub: 'Riunione domani alle 14', preview: 'Confermo la nostra riunione per domani pomeriggio per discutere...', time: '13:15' },
                { name: 'Studio Legale', tag: 'Per Conoscenza', tagColor: 'bg-yellow-100 text-yellow-700', sub: 'Revisione Contratto Necessaria', preview: 'Prego revisionare il contratto allegato e fornire feedback entro fine settimana...', time: '11:42' },
              ].map((e, i) => (
                <div key={i} className="flex items-start gap-3 px-4 py-4 border-b border-gray-50">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${i === 0 ? 'bg-pink-100 text-pink-600' : i === 1 ? 'bg-purple-100 text-purple-600' : 'bg-green-100 text-green-600'}`}>{e.name[0]}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-gray-900">{e.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${e.tagColor}`}>{e.tag}</span>
                    </div>
                    <div className="text-xs font-medium text-gray-700">{e.sub}</div>
                    {e.draft ? (
                      <div className="mt-1.5 text-xs text-blue-500 font-medium">· {e.draft}</div>
                    ) : (
                      <div className="text-xs text-gray-400 truncate">{e.preview}</div>
                    )}
                  </div>
                  {e.time && <span className="text-xs text-gray-400">{e.time}</span>}
                </div>
              ))}
            </div>
            {/* Floating badges */}
            <div className="absolute -right-4 top-1/3 bg-white rounded-xl shadow-lg px-3 py-2 text-xs font-medium text-gray-700 border border-gray-100">
              🏷️ Categorizzazione istantanea
            </div>
            <div className="absolute -left-4 bottom-8 bg-white rounded-xl shadow-lg px-3 py-2 text-xs font-medium text-gray-700 border border-gray-100">
              ✦ Bozze nel tuo stile
            </div>
          </div>
        </div>
      </section>

      {/* Logos */}
      <section className="py-12 bg-white border-b border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-sm font-medium text-gray-500 mb-8">Usato dalle migliori aziende italiane</p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-60">
            {['Chiomenti', 'Mediobanca', 'Fastweb', 'Pirelli', 'Banca Mediolanum', 'Generali', 'Deloitte Italia'].map(name => (
              <span key={name} className="text-base font-semibold text-gray-500">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          {features.map((feat, idx) => (
            <div key={idx} className={`rounded-3xl p-10 mb-6 relative overflow-hidden ${idx % 2 === 0 ? 'bg-[#f5f0e8]' : 'bg-[#f0f5e8]'}`}>
              <div className="absolute top-4 right-4 w-16 h-16 bg-brand" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
              <div className="grid md:grid-cols-2 gap-10 items-center">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-4 h-4 bg-brand rounded-sm" />
                    <h2 className="text-2xl font-black text-gray-900">{feat.title}</h2>
                  </div>
                  <p className="text-gray-600 leading-relaxed">{feat.desc}</p>
                </div>
                <div>
                  <EmailMockup type={feat.type} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Video section */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 bg-gray-100 rounded-full px-3 py-1 text-xs font-medium text-gray-600 mb-4">
            <span className="w-2 h-2 bg-green-400 rounded-full" />
            Demo 1 minuto
          </div>
          <h2 className="text-4xl font-black text-gray-900 mb-3">Guarda l'email admin scomparire</h2>
          <p className="text-gray-500 mb-8">Scopri come MailMind AI organizza, bozza e fa follow-up in automatico</p>
          <div className="relative rounded-2xl overflow-hidden bg-gray-900 aspect-video cursor-pointer group">
            <img src="https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80" alt="Demo" className="w-full h-full object-cover opacity-60" />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                <Play className="w-6 h-6 text-gray-900 ml-1" />
              </div>
            </div>
            <div className="absolute top-4 left-4 text-white font-black text-xl">MailMind AI</div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-5xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">INIZIA ORA</p>
          <h2 className="text-4xl font-black text-center text-gray-900 mb-12">Operativo in pochi secondi</h2>
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {[
              { num: '01', title: 'Collega la tua email', desc: 'Setup in un click con Gmail o Outlook. Nessuna configurazione richiesta.', emoji: '🔗' },
              { num: '02', title: 'MailMind impara il tuo stile', desc: 'La nostra AI studia i tuoi pattern di scrittura e le tue preferenze automaticamente.', emoji: '🧠' },
              { num: '03', title: 'Recupera il tuo tempo', desc: 'Trova la tua inbox organizzata e risposte pre-bozzate nel tuo stile.', emoji: '⚡' },
            ].map(step => (
              <div key={step.num} className="bg-[#f5f0e8] rounded-2xl p-6">
                <div className="text-sm font-light text-gray-400 mb-2">{step.num}</div>
                <div className="text-3xl mb-3">{step.emoji}</div>
                <h3 className="font-bold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm text-gray-600">{step.desc}</p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-center gap-3">
            <Link to="/onboarding" className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800">
              ✉️ Inizia con Gmail
            </Link>
            <Link to="/onboarding" className="flex items-center gap-2 border-2 border-gray-200 bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50">
              📧 Inizia con Outlook
            </Link>
          </div>
          <p className="text-center text-xs text-gray-400 mt-3">14 giorni gratis · Cancella in qualsiasi momento</p>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-[#f5f0e8]">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-4xl font-black text-center text-gray-900 mb-2">Scegli quanto velocemente vuoi lavorare</h2>
          <p className="text-center text-gray-500 mb-6">Inizia con 14 giorni gratis</p>
          <div className="flex items-center justify-center gap-2 mb-10">
            <span className="text-sm text-gray-500">Risparmia il 20% con l'annuale</span>
            <div className="flex bg-gray-200 rounded-full p-0.5">
              <button onClick={() => setAnnual(true)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${annual ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>Annuale (-20%)</button>
              <button onClick={() => setAnnual(false)} className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${!annual ? 'bg-gray-900 text-white' : 'text-gray-600'}`}>Mensile</button>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {pricingPlans.map(plan => (
              <div key={plan.name} className={`bg-white rounded-2xl p-6 border-2 ${plan.popular ? 'border-brand shadow-xl scale-105' : 'border-gray-100'}`}>
                {plan.popular && <div className="text-xs font-bold text-brand mb-2">⭐ PIÙ POPOLARE</div>}
                <h3 className="text-xl font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-sm text-gray-500 mb-4">{plan.desc}</p>
                {plan.enterprise ? (
                  <div className="text-3xl font-black text-gray-900 mb-1">{plan.price}</div>
                ) : (
                  <div className="mb-1">
                    <span className="text-4xl font-black text-gray-900">{annual ? plan.price : plan.priceMonthly}</span>
                    <span className="text-sm text-gray-500">/utente/mese</span>
                  </div>
                )}
                {!plan.enterprise && <p className="text-xs text-gray-400 mb-5">fatturato {annual ? 'annualmente' : 'mensilmente'}</p>}
                <Link to="/onboarding" className={`block text-center py-3 rounded-xl font-semibold text-sm mb-5 transition-all ${plan.popular ? 'bg-brand text-white hover:bg-brand/90' : plan.enterprise ? 'border-2 border-gray-200 text-gray-700 hover:bg-gray-50' : 'bg-gray-900 text-white hover:bg-gray-800'}`}>
                  {plan.cta}
                </Link>
                <div className="space-y-2.5">
                  {plan.features.map(f => (
                    <div key={f} className="flex gap-2 text-sm text-gray-600">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      {f}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Security */}
      <section id="security" className="py-20 bg-white border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">SICUREZZA E PRIVACY</p>
          <h2 className="text-4xl font-black text-gray-900 mb-8">Sicurezza di livello enterprise</h2>
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {['SOC 2', 'GDPR', 'ISO 27001', 'HIPAA', 'Server EU'].map(badge => (
              <div key={badge} className="bg-gray-100 rounded-full px-6 py-3 font-bold text-gray-700 text-sm">{badge}</div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              { icon: '🔒', title: 'Zero storage email', desc: 'I contenuti delle tue email non vengono mai salvati sui nostri server. Solo embedding vettoriali non reversibili.' },
              { icon: '🛡️', title: 'Server EU (GDPR)', desc: 'Infrastruttura interamente in Europa. Conformità GDPR nativa, non un ripensamento.' },
              { icon: '🔑', title: 'OAuth scope minimi', desc: 'Accediamo solo a gmail.compose e gmail.readonly. Zero accesso a Drive, Calendar o contatti.' },
            ].map(item => (
              <div key={item.title} className="bg-gray-50 rounded-2xl p-5">
                <div className="text-2xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-[#f5f0e8]">
        <div className="max-w-6xl mx-auto px-6">
          <p className="text-center text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">TESTIMONIANZE</p>
          <h2 className="text-4xl font-black text-center text-gray-900 mb-10">MailMind Love</h2>
          <div className="grid md:grid-cols-3 gap-4">
            {testimonials.slice(0, 3).map((t, i) => (
              <div key={i} className="bg-white rounded-2xl p-5 shadow-sm">
                <div className="flex items-center gap-1 mb-3">
                  {Array.from({ length: t.rating }).map((_, j) => <Star key={j} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-sm text-gray-700 leading-relaxed mb-4">{t.text}</p>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold">{t.name[0]}</div>
                  <div>
                    <div className="text-xs font-semibold text-gray-900">{t.name}</div>
                    <div className="text-xs text-gray-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-white border-t border-gray-100">
        <div className="max-w-2xl mx-auto px-6">
          <div className="bg-[#f5f0e8] rounded-3xl p-10 text-center relative overflow-hidden">
            <div className="absolute top-4 right-4 w-12 h-12 bg-brand" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
            <h2 className="text-3xl font-black text-gray-900 mb-6">Pronto a provare MailMind AI?</h2>
            <div className="flex items-center justify-center gap-3 mb-3">
              <Link to="/onboarding" className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800">
                ✉️ Inizia con Gmail
              </Link>
              <Link to="/onboarding" className="flex items-center gap-2 border-2 border-gray-300 bg-white text-gray-900 px-6 py-3 rounded-xl font-semibold hover:bg-gray-50">
                📧 Inizia con Outlook
              </Link>
            </div>
            <p className="text-xs text-gray-400">14 giorni gratis · Cancella in qualsiasi momento</p>
            <button className="mt-3 flex items-center gap-2 mx-auto border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-full text-sm hover:bg-gray-50">
              Parla con noi
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand text-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {[
              { title: 'AZIENDA', links: ['Home', 'Careers', 'Blog', 'Indice Admin Burden'] },
              { title: 'PRODOTTO', links: ['Prezzi', 'Sicurezza', 'Changelog', 'Casi Studio', 'Assistente Email AI', 'Accedi'] },
              { title: 'LEGALE', links: ['Termini di Utilizzo', 'Privacy Policy', 'Vulnerability Disclosure'] },
              { title: 'CONTATTO', links: ['LinkedIn', 'Help Center', 'Learning Hub'] },
            ].map(col => (
              <div key={col.title}>
                <div className="text-xs font-bold text-white/60 uppercase tracking-widest mb-3">{col.title}</div>
                {col.links.map(link => (
                  <a key={link} href="#" className="block text-sm text-white/80 hover:text-white mb-2 transition-colors">{link}</a>
                ))}
              </div>
            ))}
          </div>
          <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-5xl font-black text-white/90">MailMind AI</div>
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="text-sm text-white/80">Trustscore 4.8 · 1.200+ recensioni</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}