import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, X, ArrowRight, Plus } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useToast } from '@/components/ui/use-toast';

const steps = ['Connetti inbox', 'Configura calendario', 'Setup inbox', 'Scegli piano', 'Invita team', 'La tua inbox è organizzata', 'Le tue risposte', 'Note riunioni'];

export default function Onboarding() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(0);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [plan, setPlan] = useState('annual');
  const [emails, setEmails] = useState(['']);

  useEffect(() => {
    let active = true;

    Promise.all([
      base44.auth.me(),
      base44.functions.invoke('getOnboardingState', {}),
    ]).then(([user, stateRes]) => {
      if (!active) return;
      setCurrentUser(user);
      const onboardingState = stateRes.data?.onboarding_state;
      if (onboardingState) {
        setStep(onboardingState.current_step || 0);
        if (onboardingState.selected_plan && onboardingState.selected_plan !== 'none') {
          setPlan(onboardingState.selected_plan);
        }
      }
    }).finally(() => {
      if (active) setLoading(false);
    });

    return () => {
      active = false;
    };
  }, []);

  const saveState = async (partial) => {
    const res = await base44.functions.invoke('saveOnboardingState', partial);
    return res.data?.onboarding_state;
  };

  const advanceTo = async (nextStep, partial = {}) => {
    await saveState({ current_step: nextStep, ...partial });
    setStep(nextStep);
  };

  const connectInbox = async (provider) => {
    if (!currentUser?.id) {
      toast({ title: 'Sessione non pronta', description: 'Ricarica la pagina e riprova.', variant: 'destructive' });
      return;
    }

    setBusy(true);
    const providerPath = provider === 'google' ? 'google' : 'microsoft';
    const redirectUri = `${window.location.origin}/oauth/${providerPath}`;

    try {
      const res = await base44.functions.invoke('oauthStart', { provider, redirect_uri: redirectUri, user_id: currentUser.id });
      const popup = window.open(res.data.url, 'oauth', 'width=500,height=700,left=200,top=100');

      if (!popup) {
        toast({ title: 'Popup bloccato', description: 'Consenti i popup e riprova.', variant: 'destructive' });
        setBusy(false);
        return;
      }

      const handler = async (event) => {
        if (event.data?.type === 'oauth_success') {
          window.removeEventListener('message', handler);
          clearInterval(poll);
          if (provider === 'google') {
            await base44.functions.invoke('syncRecentEmails', { max_results: 25 }).catch(() => null);
          }
          await advanceTo(1, { email_connected: true });
          setBusy(false);
          toast({ title: `Inbox connessa: ${event.data.email}` });
        } else if (event.data?.type === 'oauth_error') {
          window.removeEventListener('message', handler);
          clearInterval(poll);
          setBusy(false);
          toast({ title: 'Errore connessione', description: event.data.error, variant: 'destructive' });
        }
      };

      window.addEventListener('message', handler);
      const poll = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll);
          window.removeEventListener('message', handler);
          setBusy(false);
        }
      }, 1000);
    } catch (error) {
      setBusy(false);
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    }
  };

  const confirmCalendarSetup = async () => {
    setBusy(true);
    try {
      await base44.functions.invoke('getSchedulingSettings', {});
      await advanceTo(2, { calendar_connected: true });
    } finally {
      setBusy(false);
    }
  };

  const saveInboxSetupAndContinue = async () => {
    setBusy(true);
    try {
      await advanceTo(3, { inbox_setup_completed: true });
    } finally {
      setBusy(false);
    }
  };

  const savePlanAndContinue = async () => {
    setBusy(true);
    try {
      await advanceTo(4, { selected_plan: plan });
    } finally {
      setBusy(false);
    }
  };

  const sendInvitesAndContinue = async () => {
    const validEmails = [...new Set(emails.map((email) => email.trim().toLowerCase()).filter(Boolean))];
    setBusy(true);
    try {
      if (validEmails.length > 0) {
        for (const email of validEmails) {
          await base44.users.inviteUser(email, 'user');
        }
        await base44.functions.invoke('recordWorkspaceInvites', { emails: validEmails });
      }
      await advanceTo(5, { invited_teammates_count: validEmails.length });
    } finally {
      setBusy(false);
    }
  };

  const continueStep = async (nextStep) => {
    setBusy(true);
    try {
      await advanceTo(nextStep);
    } finally {
      setBusy(false);
    }
  };

  const completeOnboarding = async () => {
    setBusy(true);
    try {
      await saveState({ current_step: 7, completed: true });
      navigate('/dashboard');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Caricamento onboarding...</div>;
  }

  return (
    <div className="min-h-screen bg-white font-inter">
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-brand font-black text-xl">MailMind AI</span>
        <button onClick={() => navigate('/Home')} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
      </div>

      <div className="flex h-[calc(100vh-57px)]">
        <div className="w-32 flex flex-col items-start px-6 py-8 gap-0 relative">
          {steps.slice(0, 6).map((label, index) => (
            <div key={index} className="flex flex-col items-start">
              <div className="flex items-center gap-2 mb-0">
                <div className={`w-3 h-3 rounded-full border-2 transition-all flex-shrink-0 ${index <= step ? 'bg-brand border-brand' : 'bg-white border-gray-300'}`} />
              </div>
              {index < 5 && <div className={`w-0.5 h-8 ml-[5px] ${index < step ? 'bg-brand' : 'bg-gray-200'}`} />}
            </div>
          ))}
          <div className="absolute left-12 top-8 space-y-0">
            {steps.slice(0, 6).map((label, index) => (
              <div key={index} className={`text-xs py-[14px] font-medium transition-colors ${index === step ? 'text-gray-900' : index < step ? 'text-brand' : 'text-gray-300'}`}>
                {label}
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          {step === 0 && (
            <div className="max-w-md w-full">
              <div className="bg-[#f5f0e8] rounded-xl px-4 py-2 text-sm text-gray-600 mb-6 text-center">La tua inbox rimane sicura.</div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">Collega la tua inbox di lavoro</h2>
              <p className="text-gray-500 mb-6">MailMind AI organizza le email e prepara bozze senza inviare nulla per tuo conto.</p>
              <button onClick={() => connectInbox('google')} disabled={busy} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 mb-3 disabled:opacity-50">✉️ Collega Gmail</button>
              <button onClick={() => connectInbox('microsoft')} disabled={busy} className="w-full text-center text-sm text-brand font-medium hover:underline disabled:opacity-50">Collega Outlook</button>
            </div>
          )}

          {step === 1 && (
            <div className="max-w-md w-full">
              <div className="bg-[#f5f0e8] rounded-xl px-4 py-2 text-sm text-gray-600 mb-6 text-center">Inbox collegata</div>
              <h2 className="text-3xl font-black text-gray-900 mb-2">Conferma la configurazione del calendario</h2>
              <p className="text-gray-500 mb-6">Useremo la tua disponibilità per aiutarti con riunioni, link di prenotazione e proposte automatiche.</p>
              <button onClick={confirmCalendarSetup} disabled={busy} className="w-full flex items-center justify-center gap-2 bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 mb-3 disabled:opacity-50">📅 Continua con calendario</button>
            </div>
          )}

          {step === 2 && (
            <div className="max-w-lg w-full">
              <h2 className="text-2xl font-black text-gray-900 mb-2">Mantieni ciò che è importante nella tua inbox</h2>
              <p className="text-gray-500 mb-5">MailMind AI etichetta le email, mantiene le più importanti nella tua inbox e archivia il resto.</p>
              <button onClick={saveInboxSetupAndContinue} disabled={busy} className="flex items-center gap-2 bg-gray-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50">Continua <ArrowRight className="w-4 h-4" /></button>
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
                ].map((currentPlan) => (
                  <div key={currentPlan.key} onClick={() => setPlan(currentPlan.key)} className={`border-2 rounded-2xl p-5 cursor-pointer transition-all ${plan === currentPlan.key ? 'border-gray-900' : 'border-gray-200'}`}>
                    {currentPlan.popular && <div className="text-xs bg-gray-900 text-white px-2 py-0.5 rounded-full inline-block mb-2">Più popolare</div>}
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-900">{currentPlan.label}</span>
                      <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded">{currentPlan.badge}</span>
                    </div>
                    <div className="text-2xl font-black text-gray-900 mb-3">{currentPlan.price}</div>
                  </div>
                ))}
              </div>
              <button onClick={savePlanAndContinue} disabled={busy} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50">Salva piano e continua</button>
            </div>
          )}

          {step === 4 && (
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
              <div className="bg-[#f5f0e8] rounded-xl p-4 mb-5 space-y-2">
                {emails.map((email, index) => (
                  <input key={index} type="email" value={email} onChange={(event) => setEmails((prev) => prev.map((item, currentIndex) => currentIndex === index ? event.target.value : item))} className="w-full bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="collega@azienda.com" />
                ))}
                <button onClick={() => setEmails((prev) => [...prev, ''])} className="flex items-center gap-1 text-sm text-gray-600 mt-2 hover:text-gray-900"><Plus className="w-4 h-4" /> Aggiungi un altro</button>
              </div>
              <h3 className="text-xl font-black text-gray-900 mb-2">Invita il tuo team</h3>
              <p className="text-sm text-gray-500 mb-4">Invita i colleghi e salva gli inviti direttamente durante l'onboarding.</p>
              <button onClick={sendInvitesAndContinue} disabled={busy} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 mb-3 disabled:opacity-50">Continua</button>
              <button onClick={() => continueStep(5)} disabled={busy} className="w-full text-center text-sm text-gray-500 hover:text-gray-700 disabled:opacity-50">Salta questo passaggio</button>
            </div>
          )}

          {step === 5 && (
            <div className="max-w-lg w-full">
              <h3 className="text-2xl font-black text-gray-900 mb-2">La tua inbox è organizzata</h3>
              <p className="text-sm text-gray-500 mb-4">MailMind AI è pronto a organizzare le email e aiutarti con le priorità.</p>
              <button onClick={() => continueStep(6)} disabled={busy} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50">Continua</button>
            </div>
          )}

          {step === 6 && (
            <div className="max-w-md w-full">
              <h3 className="text-2xl font-black text-gray-900 mb-2">Le tue risposte sono pre-scritte</h3>
              <p className="text-sm text-gray-500 mb-4">Quando ricevi un'email a cui rispondere, MailMind AI prepara una bozza da rivedere e inviare.</p>
              <button onClick={() => continueStep(7)} disabled={busy} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50">Continua</button>
            </div>
          )}

          {step >= 7 && (
            <div className="max-w-md w-full">
              <h3 className="text-2xl font-black text-gray-900 mb-2">Anche le tue note di riunione</h3>
              <p className="text-sm text-gray-500 mb-4">L'onboarding è completo: puoi iniziare a usare MailMind AI subito.</p>
              <button onClick={completeOnboarding} disabled={busy} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50">Esplora MailMind AI</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}