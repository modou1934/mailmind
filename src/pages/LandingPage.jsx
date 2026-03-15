import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Check, Star } from 'lucide-react';

const InboxMockup = ({ emails }) => (
  <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
    <div className="flex items-center gap-1.5 px-4 py-3 border-b border-gray-100">
      <div className="w-3 h-3 rounded-full bg-red-400" />
      <div className="w-3 h-3 rounded-full bg-yellow-400" />
      <div className="w-3 h-3 rounded-full bg-green-400" />
      <span className="ml-auto text-xs text-gray-400 font-medium">Posta in arrivo</span>
    </div>
    <div className="divide-y divide-gray-50">
      {emails.map((email, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0 ${email.color}`}>
            {email.avatar}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-gray-900">{email.from}</span>
              {email.badge && (
                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${email.badgeColor}`}>
                  {email.badge}
                </span>
              )}
              {email.draftBadge && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
                  Bozza
                </span>
              )}
            </div>
            <div className="text-xs font-medium text-gray-700 mb-0.5">{email.subject}</div>
            <div className="text-xs text-gray-400 truncate">{email.preview}</div>
            {email.draft && (
              <div className="mt-2 text-xs text-gray-700 bg-gray-50 rounded-lg p-2 border-l-2 border-brand">
                {email.draft}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400 flex-shrink-0">{email.time}</div>
        </div>
      ))}
    </div>
  </div>
);

const logos = ['Deloitte', 'Legance', 'Mediobanca', 'Pirelli', 'Ferrero', 'Bain & Co.', 'Notartel', 'Cattolica'];

const pricingPlans = [
  {
    name: 'Solo',
    price: 19,
    desc: 'Freelance, consulenti, professionisti individuali',
    features: ['200 bozze/mese', 'Triage intelligente inbox', 'Digest mattutino', '1 account email', 'Supporto via email'],
    cta: 'Inizia gratis',
    highlight: false,
  },
  {
    name: 'Pro',
    price: 39,
    desc: 'Manager, imprenditori, avvocati, commercialisti',
    features: ['Bozze illimitate', 'Integrazione PEC', 'Notetaker riunioni (5h/mese)', 'Template PA italiani', '2 account email (Gmail + Outlook)', 'Analytics avanzate', 'Supporto email + chat'],
    cta: 'Inizia gratis 14 giorni',
    highlight: true,
    badge: 'Più popolare',
  },
  {
    name: 'Studio / Team',
    price: 29,
    desc: 'Studi legali, commercialisti, PMI (min. 5 utenti)',
    perUser: true,
    features: ['Tutto di Pro', 'Bozze illimitate', 'PEC multi-account', 'Template PA personalizzabili', 'Dashboard team + report', 'Onboarding dedicato', 'Fattura italiana'],
    cta: 'Parla con noi',
    highlight: false,
  },
];

const steps = [
  { num: '01', title: 'Connetti la tua email', desc: 'Setup in un click con Gmail o Outlook. Nessuna configurazione necessaria.' },
  { num: '02', title: 'MailMind impara il tuo stile', desc: 'La nostra AI studia le tue email inviate e crea il tuo profilo stilistico.' },
  { num: '03', title: 'Riprendi il tuo tempo', desc: 'Trova la inbox organizzata e le risposte già scritte, nel tuo stile.' },
];

const testimonials = [
  { name: 'Francesca Merli', role: 'Avvocato, Studio Merli & Associati', text: 'Finalmente un tool che capisce il "Lei" formale. Le bozze per le comunicazioni con la PA sono perfette. Mi risparmio 90 minuti al giorno.' },
  { name: 'Marco Veronesi', role: 'CEO, PMI Brescia', text: 'La PEC integrata con Gmail è stata una svolta. Non ho più due inbox separate. MailMind AI ha risolto un problema che avevo da anni.' },
  { name: 'Giulia Fontana', role: 'Commercialista, Bologna', text: 'Durante la stagione fiscale gestisco 150+ email al giorno. MailMind AI ha ridotto questo a 30 minuti. Incredibile.' },
  { name: 'Alessandro Ricci', role: 'Account Manager, Milano', text: 'Le bozze vengono generate nel mio tono preciso, non testo generico AI. I clienti non si accorgono della differenza.' },
  { name: 'Sofia Bianchi', role: 'HR Manager, Roma', text: 'Il notetaker per le riunioni è fantastico. Trascrizione in italiano perfetta, anche con accenti diversi del team.' },
];

export default function LandingPage() {
  const [billing, setBilling] = useState('annual');
  const [openFaq, setOpenFaq] = useState(null);

  const faqs = [
    { q: 'I miei dati email sono al sicuro?', a: 'Assolutamente. MailMind AI non archivia mai il contenuto delle tue email sui nostri server. Salviamo solo vettori semantici (non reversibili in testo) e metadati strutturati. Tutti i server sono in EU (Francoforte), conformi GDPR.' },
    { q: "Come funziona l'integrazione PEC?", a: "Supportiamo PEC Aruba, Legalmail, Namirial e TIM PEC via IMAP/SMTP certificato. Visualizzi tutto in un'unica inbox integrata con Gmail o Outlook." },
    { q: 'Quante email analizza per imparare il mio stile?', a: 'MailMind AI analizza gli ultimi 90 giorni di email inviate (non ricevute — quelle inviate contengono il tuo stile). Con 200+ email inviate il sistema raggiunge un matching stilistico eccellente.' },
    { q: 'Posso cancellare in qualsiasi momento?', a: 'Sì, puoi cancellare in qualsiasi momento senza penali. Puoi disconnettere il tuo account email e richiedere la cancellazione di tutti i tuoi dati (diritto all\'oblio GDPR) dalla pagina Impostazioni.' },
    { q: 'Cosa rende MailMind AI diverso da Fyxer o da ChatGPT?', a: 'A differenza di Fyxer (costruito per il mercato anglofono), MailMind AI è nativo per l\'italiano: gestisce il "Lei" formale, le formule di apertura/chiusura corrette, i template PA, e integra la PEC. A differenza di ChatGPT, non devi scrivere prompt ogni volta — impara il tuo stile automaticamente.' },
  ];

  return (
    <div className="min-h-screen bg-white font-inter">
      {/* Navbar */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link to="/" className="text-brand font-black text-xl tracking-tight">MailMind AI</Link>
            <nav className="hidden md:flex items-center gap-6 text-sm text-gray-600">
              <a href="#prezzi" className="hover:text-gray-900 transition-colors">Prezzi</a>
              <a href="#sicurezza" className="hover:text-gray-900 transition-colors">Sicurezza</a>
              <button className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                Per i Team <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <button className="flex items-center gap-1 hover:text-gray-900 transition-colors">
                Risorse <ChevronDown className="w-3.5 h-3.5" />
              </button>
              <a href="#" className="hover:text-gray-900 transition-colors">Blog</a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/dashboard" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">Accedi</Link>
            <button className="text-sm px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors">
              Parla con noi
            </button>
            <span className="text-sm text-gray-500 hidden md:inline">Inizia gratis:</span>
            <Link to="/onboarding" className="flex items-center gap-1.5 bg-gray-900 text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium">
              <span className="text-base">M</span>
            </Link>
            <Link to="/onboarding" className="flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-sm px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors font-medium">
              <span className="text-blue-600 font-bold text-base">O</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="bg-white pt-20 pb-16 text-center px-6">
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-sm text-gray-600 mb-8 shadow-sm">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Unisciti a 10.000+ professionisti italiani
          </div>
          <h1 className="text-5xl md:text-6xl font-black text-gray-900 leading-tight mb-2 tracking-tight">
            Il tuo assistente per
          </h1>
          <h1 className="text-5xl md:text-6xl font-black leading-tight mb-8 tracking-tight text-brand">
            scrivere in italiano
          </h1>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-3">
            <Link to="/onboarding" className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors w-full sm:w-auto justify-center">
              <span className="text-base">M</span>
              Inizia con Gmail
            </Link>
            <Link to="/onboarding" className="flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-800 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors w-full sm:w-auto justify-center">
              <span className="text-blue-600 font-bold">O</span>
              Inizia con Outlook
            </Link>
          </div>
          <p className="text-sm text-gray-400 mb-3">Prova gratuita 14 giorni • Cancella quando vuoi</p>
          <button className="text-sm text-gray-600 border border-gray-200 rounded-full px-4 py-1.5 hover:bg-gray-50 transition-colors">
            Parla con noi
          </button>
        </div>
      </section>

      {/* Inbox mockup */}
      <section className="max-w-2xl mx-auto px-6 mb-4">
        <div className="relative">
          <InboxMockup emails={[
            { avatar: 'S', color: 'bg-pink-400', from: 'Sarah Chen', subject: 'Re: Budget Q4', preview: 'Ciao, volevo seguire la nostra discussione sul budget Q4...', badge: 'Da Rispondere', badgeColor: 'bg-red-100 text-red-700', time: '14:34',
              draft: '✨ AI generazione in corso... "Grazie per il follow-up, Sarah. Ho rivisto la proposta..."' },
            { avatar: 'J', color: 'bg-purple-400', from: 'Giovanni Martini', subject: 'Riunione domani alle 14', preview: 'Confermo la nostra riunione per domani pomeriggio...', badge: 'Aggiornamento', badgeColor: 'bg-purple-100 text-purple-700', time: '13:15' },
            { avatar: 'L', color: 'bg-teal-400', from: 'Studio Legale Ferrari', subject: 'Revisione contratto', preview: 'Si prega di rivedere il contratto allegato e fornire...', badge: 'Per Conoscenza', badgeColor: 'bg-orange-100 text-orange-700', time: '11:42' },
          ]} />
          <div className="absolute -left-4 top-8 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-full shadow-lg font-medium">
            Bozze nel tuo stile
          </div>
          <div className="absolute -right-4 top-16 bg-white border border-gray-200 text-xs px-3 py-1.5 rounded-full shadow-lg font-medium text-gray-700">
            Categorizzazione istantanea
          </div>
        </div>
      </section>

      {/* Section: organizziamo */}
      <section className="py-20 px-6 bg-cream">
        <div className="max-w-5xl mx-auto">
          {/* Section label */}
          <div className="text-center mb-16">
            <div className="text-2xl font-black text-gray-900 mb-1">Usato nelle principali organizzazioni italiane</div>
          </div>
          {/* Logo marquee */}
          <div className="overflow-hidden mb-20">
            <div className="flex gap-12 animate-marquee whitespace-nowrap">
              {[...logos, ...logos].map((l, i) => (
                <span key={i} className="text-gray-400 font-bold text-sm tracking-wide uppercase flex-shrink-0">{l}</span>
              ))}
            </div>
          </div>

          {/* Feature 1: Organize */}
          <div className="bg-cream rounded-3xl p-10 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-0 h-0 border-l-[60px] border-l-transparent border-t-[60px] border-brand" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-sm bg-brand" />
              <span className="text-xl font-bold text-gray-900">Organizziamo la tua inbox</span>
            </div>
            <p className="text-gray-600 mb-8 max-w-lg">
              Ogni email categorizzata automaticamente con etichette intelligenti. Spam e rumore filtrati. Solo quello che conta rimane visibile.
            </p>
            <InboxMockup emails={[
              { avatar: 'S', color: 'bg-pink-400', from: 'Sarah Chen', subject: 'Q4 Budget Review', preview: 'Ciao, volevo seguire la nostra discussione sul budget...', badge: 'Da Rispondere', badgeColor: 'bg-red-100 text-red-700', time: '14:34' },
              { avatar: 'J', color: 'bg-purple-400', from: 'Giovanni Martini', subject: 'Riunione domani alle 14', preview: 'Confermo la nostra riunione per domani pomeriggio...', badge: 'Aggiornamento', badgeColor: 'bg-purple-100 text-purple-700', time: '13:15' },
              { avatar: 'L', color: 'bg-teal-400', from: 'Comune di Milano', subject: 'Istanza protocollata', preview: 'La sua istanza è stata ricevuta e protocollata con n....', badge: 'Burocrazia', badgeColor: 'bg-blue-100 text-blue-700', time: '11:42' },
            ]} />
          </div>

          {/* Feature 2: Draft */}
          <div className="bg-cream rounded-3xl p-10 mb-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-0 h-0 border-l-[60px] border-l-transparent border-t-[60px] border-brand" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-sm bg-green-500" />
              <span className="text-xl font-bold text-gray-900">Scriviamo nel tuo stile</span>
            </div>
            <p className="text-gray-600 mb-8 max-w-lg">
              Risposte pre-scritte nel tuo tono, pronte da inviare. Con il "Lei" formale corretto, le giuste formule italiane, e la grammatica perfetta.
            </p>
            <InboxMockup emails={[
              { avatar: 'M', color: 'bg-blue-400', from: 'Michele Rossi', subject: 'Proposta di partnership', preview: 'Salve, vorrei discutere una potenziale collaborazione...', time: '10:23',
                draftBadge: true,
                draft: 'La ringrazio per il contatto. Ho esaminato la Sua proposta di partnership e sono lieto di comunicarLe che l\'iniziativa mi pare di sicuro interesse. Sarei disponibile per un incontro telefonico martedì o giovedì pomeriggio. Cordiali saluti' },
            ]} />
          </div>

          {/* Feature 3: Meetings */}
          <div className="bg-cream rounded-3xl p-10 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-0 h-0 border-l-[60px] border-l-transparent border-t-[60px] border-brand" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-3 h-3 rounded-sm bg-blue-500" />
              <span className="text-xl font-bold text-gray-900">Prendiamo nota per te in ogni riunione</span>
            </div>
            <p className="text-gray-600 mb-8 max-w-lg">
              Note di riunione consegnate in inbox istantaneamente. Email di follow-up già pronte, in italiano perfetto.
            </p>
            <InboxMockup emails={[
              { avatar: 'M', color: 'bg-brand', from: 'MailMind AI', subject: 'Note Riunione: Product Roadmap Q2', preview: 'La tua riunione è appena terminata. Ecco il riepilogo...', time: 'Adesso',
                draft: '• Discusso roadmap prodotto Q2 e priorità\n• Marco invia mockup design entro venerdì\n• Budget approvato per nuovi ingressi\n• Prossima sync: martedì 14:00' },
            ]} />
          </div>
        </div>
      </section>

      {/* Demo video */}
      <section className="py-20 px-6 bg-white text-center">
        <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-1.5 text-sm text-gray-500 mb-6 shadow-sm">
          <span className="w-2 h-2 rounded-full bg-green-500" />
          Demo 1 minuto
        </div>
        <h2 className="text-3xl font-black text-gray-900 mb-4">Guarda come l'email admin sparisce</h2>
        <p className="text-gray-500 mb-8">Scopri come MailMind AI organizza, scrive e fa follow-up — in automatico</p>
        <div className="max-w-2xl mx-auto bg-gray-900 rounded-2xl overflow-hidden aspect-video flex items-center justify-center cursor-pointer group shadow-2xl">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center group-hover:bg-white/30 transition-colors">
            <div className="w-0 h-0 border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent border-l-[18px] border-white ml-1" />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">PER INIZIARE</div>
          <h2 className="text-3xl font-black text-gray-900 mb-12">Operativo in pochi secondi</h2>
          <div className="grid md:grid-cols-3 gap-8 mb-10">
            {steps.map((s) => (
              <div key={s.num} className="text-center">
                <div className="text-sm font-light text-gray-400 mb-2">{s.num}</div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{s.title}</h3>
                <p className="text-sm text-gray-500">{s.desc}</p>
                <div className="mt-4 bg-cream rounded-xl h-24 flex items-center justify-center">
                  <div className="w-12 h-12 bg-gray-300 rounded-lg animate-pulse" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/onboarding" className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors justify-center">
              <span>M</span> Inizia con Gmail
            </Link>
            <Link to="/onboarding" className="flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-800 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors justify-center">
              <span className="text-blue-600 font-bold">O</span> Inizia con Outlook
            </Link>
          </div>
          <p className="text-xs text-gray-400 mt-3">Prova gratuita 14 giorni • Cancella quando vuoi</p>
        </div>
      </section>

      {/* Security */}
      <section id="sicurezza" className="py-20 px-6 bg-cream">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">SICUREZZA E PRIVACY</div>
          <h2 className="text-3xl font-black text-gray-900 mb-6">Sicurezza enterprise</h2>
          <div className="flex flex-wrap justify-center gap-6 mb-12">
            {['GDPR', 'HIPAA', 'ISO 27001', 'SOC 2', 'Zero Storage'].map(cert => (
              <div key={cert} className="bg-white border border-gray-200 rounded-xl px-6 py-3 text-sm font-bold text-gray-700 shadow-sm">
                {cert}
              </div>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-6 text-left">
            {[
              { title: 'Zero Email Storage', desc: 'Il contenuto delle tue email non viene mai salvato sui nostri server. Solo vettori semantici non reversibili.' },
              { title: 'Server in Europa', desc: 'Tutti i dati elaborati e archiviati in EU (Francoforte). Piena conformità GDPR fin dal giorno 1.' },
              { title: 'OAuth Minimale', desc: 'Richiediamo solo i permessi strettamente necessari. Vedi esattamente cosa autorizzi.' },
            ].map(item => (
              <div key={item.title} className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto">
          <div className="text-xs font-bold text-gray-400 uppercase tracking-widest text-center mb-3">TESTIMONIANZE</div>
          <h2 className="text-3xl font-black text-gray-900 text-center mb-12">MailMind Love</h2>
          <div className="grid md:grid-cols-3 gap-5">
            {testimonials.slice(0, 3).map((t) => (
              <div key={t.name} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-center gap-1 mb-3">
                  {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
                </div>
                <p className="text-sm text-gray-700 mb-4 leading-relaxed">"{t.text}"</p>
                <div>
                  <div className="text-sm font-semibold text-gray-900">{t.name}</div>
                  <div className="text-xs text-gray-500">{t.role}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="prezzi" className="py-20 px-6 bg-cream">
        <div className="max-w-5xl mx-auto text-center">
          <h2 className="text-3xl font-black text-gray-900 mb-2">Scegli quanto veloce vuoi lavorare</h2>
          <p className="text-gray-500 mb-8">A partire da una prova gratuita di 14 giorni</p>
          <div className="inline-flex items-center bg-white border border-gray-200 rounded-full p-1 mb-10 shadow-sm">
            <button
              onClick={() => setBilling('annual')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billing === 'annual' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Annuale (−20%)
            </button>
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${billing === 'monthly' ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
            >
              Mensile
            </button>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {pricingPlans.map((plan) => (
              <div
                key={plan.name}
                className={`bg-white rounded-2xl p-7 text-left border-2 transition-all ${
                  plan.highlight ? 'border-gray-900 shadow-xl scale-105' : 'border-gray-100 shadow-sm'
                }`}
              >
                {plan.badge && (
                  <div className="text-xs font-bold text-brand border border-brand/30 bg-brand/5 rounded-full px-3 py-1 inline-block mb-3">
                    {plan.badge}
                  </div>
                )}
                <h3 className="text-lg font-bold text-gray-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-gray-500 mb-4">{plan.desc}</p>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-black text-gray-900">
                    €{billing === 'annual' ? Math.round(plan.price * 0.8) : plan.price}
                  </span>
                  <span className="text-gray-500 text-sm">/utente/mese</span>
                </div>
                {billing === 'annual' && <div className="text-xs text-gray-400 mb-5">fatturato annualmente</div>}
                <ul className="space-y-2 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-sm text-gray-700">
                      <Check className="w-4 h-4 text-brand flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  to="/onboarding"
                  className={`block text-center py-3 px-6 rounded-xl font-semibold text-sm transition-colors ${
                    plan.highlight
                      ? 'bg-brand text-white hover:bg-brand/90'
                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-black text-gray-900 text-center mb-10">Domande frequenti</h2>
          <div className="space-y-3">
            {faqs.map((faq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left text-sm font-semibold text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  {faq.q}
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-gray-600 leading-relaxed border-t border-gray-100 pt-3">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA finale */}
      <section className="py-16 px-6 bg-cream">
        <div className="max-w-lg mx-auto text-center bg-white rounded-3xl p-10 shadow-sm border border-gray-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-0 h-0 border-l-[60px] border-l-transparent border-t-[60px] border-brand" />
          <h2 className="text-2xl font-black text-gray-900 mb-4">Pronto a provare MailMind AI?</h2>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-4">
            <Link to="/onboarding" className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-800 transition-colors justify-center">
              <span>M</span> Inizia con Gmail
            </Link>
            <Link to="/onboarding" className="flex items-center gap-2 bg-white border-2 border-gray-200 text-gray-800 px-6 py-3 rounded-xl font-semibold text-sm hover:bg-gray-50 transition-colors justify-center">
              <span className="text-blue-600 font-bold">O</span> Inizia con Outlook
            </Link>
          </div>
          <p className="text-xs text-gray-400 mb-4">Prova gratuita 14 giorni • Cancella quando vuoi</p>
          <button className="text-sm text-gray-600 border border-gray-200 rounded-full px-4 py-1.5 hover:bg-gray-50 transition-colors">
            Parla con noi
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-brand text-white px-6 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-4 text-white/60">AZIENDA</div>
              {['Home', 'Carriere', 'Blog', 'ROI Calculator'].map(l => (
                <div key={l} className="text-sm text-white/80 hover:text-white mb-2 cursor-pointer">{l}</div>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-4 text-white/60">PRODOTTO</div>
              {['Prezzi', 'Sicurezza', 'Changelog', 'Storie clienti', 'Accedi'].map(l => (
                <div key={l} className="text-sm text-white/80 hover:text-white mb-2 cursor-pointer">{l}</div>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-4 text-white/60">LEGALE</div>
              {['Termini di servizio', 'Privacy Policy', 'Cookie Policy'].map(l => (
                <div key={l} className="text-sm text-white/80 hover:text-white mb-2 cursor-pointer">{l}</div>
              ))}
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider mb-4 text-white/60">CONTATTI</div>
              {['LinkedIn', 'Help Center', 'Supporto IT'].map(l => (
                <div key={l} className="text-sm text-white/80 hover:text-white mb-2 cursor-pointer">{l}</div>
              ))}
            </div>
          </div>
          <div className="border-t border-white/20 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-4xl font-black text-white">MailMind AI</div>
            <div className="flex items-center gap-2">
              <div className="flex gap-1">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)}
              </div>
              <span className="text-white/80 text-sm">Trustscore 4.8 • 2.340 recensioni</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}