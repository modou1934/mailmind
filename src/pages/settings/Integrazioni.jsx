import { useState, useEffect } from 'react';
import { ChevronDown, Check, Trash2, Info, Loader2, RefreshCw } from 'lucide-react';
import { api } from '@/api/privateApiClient';
import { useToast } from '@/components/ui/use-toast';


const faqs = [
  'Cosa succede se ho già un sistema di etichette email?',
  'Cosa rappresentano le diverse categorie email?',
  'Il mio sistema tornerà alla normalità se non mi piace il prodotto?',
  'Come posso includere la mia firma email nelle bozze?',
  'Quando appariranno le mie bozze?',
  'Come funziona la feature Calendario?',
  'Esiste un programma di referral?',
];

const operationalStatusMeta = {
  active: { label: 'Operativo', className: 'bg-green-50 text-green-700 border-green-200' },
  attention: { label: 'Attenzione', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  error: { label: 'Errore', className: 'bg-red-50 text-red-700 border-red-200' },
  demo: { label: 'Demo locale', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const syncStatusMeta = {
  healthy: { label: 'Sync ok', className: 'bg-green-50 text-green-700 border-green-200' },
  stale: { label: 'Sync fermo', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  idle: { label: 'Mai sincronizzato', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  failed: { label: 'Sync fallita', className: 'bg-red-50 text-red-700 border-red-200' },
};

const subscriptionStatusMeta = {
  active: { label: 'Webhook attivo', className: 'bg-green-50 text-green-700 border-green-200' },
  expiring: { label: 'Webhook in scadenza', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  expired: { label: 'Webhook scaduto', className: 'bg-red-50 text-red-700 border-red-200' },
  pending: { label: 'Webhook in attesa', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  error: { label: 'Webhook in errore', className: 'bg-red-50 text-red-700 border-red-200' },
  auth_error: { label: 'OAuth da rifare', className: 'bg-red-50 text-red-700 border-red-200' },
  not_configured: { label: 'Webhook non configurato', className: 'bg-slate-100 text-slate-700 border-slate-200' },
  demo: { label: 'Webhook demo', className: 'bg-slate-100 text-slate-700 border-slate-200' },
};

function formatDateTime(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleString('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

function StatusBadge({ meta }) {
  if (!meta) {
    return null;
  }

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${meta.className}`}>
      {meta.label}
    </span>
  );
}

function accountHasCapability(account, capability) {
  return Array.isArray(account.capabilities) && account.capabilities.includes(capability);
}

export default function Integrazioni() {
  const [expandedFaq, setExpandedFaq] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [syncingAccountId, setSyncingAccountId] = useState(null);
  const { toast } = useToast();

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await api.get('/integrations/accounts');
      setAccounts(res.accounts || []);
    } catch (e) {
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const connectProvider = async (provider) => {
    setConnecting(provider);

    try {
      const res = await api.post(`/integrations/oauth/${provider}/start`);
      const authUrl = res.url;

      const popup = window.open(authUrl, 'oauth', 'width=500,height=700,left=200,top=100');

      if (!popup) {
        toast({ title: 'Popup bloccato', description: 'Consenti i popup per questo sito e riprova.', variant: 'destructive' });
        setConnecting(null);
        return;
      }

      const handler = (event) => {
        if (event.data?.type === 'oauth_success') {
          window.removeEventListener('message', handler);
          clearInterval(poll);
          setConnecting(null);
          toast({ title: `Account connesso: ${event.data.email}` });
          loadAccounts();
        } else if (event.data?.type === 'oauth_error') {
          window.removeEventListener('message', handler);
          clearInterval(poll);
          setConnecting(null);
          toast({ title: 'Errore connessione', description: event.data.error, variant: 'destructive' });
        }
      };
      window.addEventListener('message', handler);

      const poll = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll);
          window.removeEventListener('message', handler);
          setConnecting(null);
          loadAccounts();
        }
      }, 1000);
    } catch (e) {
      setConnecting(null);
      toast({ title: 'Errore', description: e.message, variant: 'destructive' });
    }
  };

  const disconnect = async (accountId) => {
    try {
      await api.delete(`/integrations/accounts/${accountId}`);
      toast({ title: 'Account disconnesso' });
      loadAccounts();
    } catch (error) {
      toast({ title: 'Errore disconnessione', description: error.message, variant: 'destructive' });
    }
  };

  const syncAccount = async (accountId) => {
    setSyncingAccountId(accountId);
    try {
      const res = await api.post('/mail/sync', { accountId });
      toast({
        title: 'Sincronizzazione completata',
        description: `${res.processedThreads} thread, ${res.processedMessages} messaggi importati e ${res.categorizedThreads} thread categorizzati.`,
      });
      await loadAccounts();
    } catch (error) {
      toast({ title: 'Errore sincronizzazione', description: error.message, variant: 'destructive' });
    } finally {
      setSyncingAccountId(null);
    }
  };

  const googleAccounts = accounts.filter(a => a.provider === 'google' && accountHasCapability(a, 'mail'));
  const microsoftAccounts = accounts.filter(a => a.provider === 'microsoft' && accountHasCapability(a, 'mail'));
  const googleCalendarAccounts = accounts.filter(a => a.provider === 'google' && accountHasCapability(a, 'calendar'));
  const microsoftCalendarAccounts = accounts.filter(a => a.provider === 'microsoft' && accountHasCapability(a, 'calendar'));
  const zoomAccounts = accounts.filter(a => a.provider === 'zoom');

  const AccountItem = ({ account }) => (
    <div className="bg-gray-50 rounded-lg p-2.5 flex items-center justify-between mt-2">
      <div className="flex items-start gap-2">
        <Check className="w-4 h-4 text-green-500" />
        <div className="space-y-1">
          <div className="text-xs font-medium text-gray-700">{account.email}</div>
          <div className="flex flex-wrap gap-1">
            <StatusBadge meta={operationalStatusMeta[account.operational_status]} />
            <StatusBadge meta={syncStatusMeta[account.last_sync_status]} />
            <StatusBadge meta={subscriptionStatusMeta[account.subscription_status]} />
          </div>
          <div className="text-xs text-gray-400">
            Connesso {formatDateTime(account.connected_at) || 'adesso'}
            {account.last_synced_at ? ` • Ultima sync ${formatDateTime(account.last_synced_at)}` : ' • Nessuna sync'}
          </div>
          <div className="text-xs text-gray-400">
            {account.thread_count} thread • {account.draft_count} bozze
          </div>
          {account.capabilities?.length ? (
            <div className="flex flex-wrap gap-1">
              {account.capabilities.map((capability) => (
                <span key={`${account.id}-${capability}`} className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                  {capability}
                </span>
              ))}
            </div>
          ) : null}
          <div className="text-xs text-gray-400">
            {account.last_webhook_at ? `Ultimo webhook ${formatDateTime(account.last_webhook_at)}` : 'Nessun webhook ricevuto'}
            {account.subscription_expires_at ? ` • Scade ${formatDateTime(account.subscription_expires_at)}` : ''}
          </div>
          <div className="text-xs text-gray-400">
            {account.provider === 'google'
              ? (account.sync_cursor_available ? 'History cursor Gmail presente' : 'History cursor Gmail assente')
              : account.provider === 'microsoft'
                ? (account.delta_link_available ? 'Delta link Microsoft presente' : 'Delta link Microsoft assente')
                : 'Provider meeting-only: webhook Zoom pronto'}
          </div>
          {account.last_sync_error ? (
            <div className="text-xs text-red-600">{account.last_sync_error}</div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {account.provider !== 'zoom' ? (
          <button
            onClick={() => syncAccount(account.id)}
            disabled={syncingAccountId === account.id}
            className="relative z-10 text-gray-400 hover:text-gray-700 disabled:opacity-50"
            title="Sincronizza mailbox"
          >
            {syncingAccountId === account.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
        ) : null}
        <button onClick={() => disconnect(account.id)} className="relative z-10 text-gray-400 hover:text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const ProviderCard = ({ icon, name, provider, connectedAccounts, description = '' }) => (
    <div className="border border-gray-100 rounded-xl p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{icon}</span>
          <div>
            <div className="text-sm font-semibold text-gray-900">{name}</div>
            {connectedAccounts.length > 0 ? (
              <div className="flex items-center gap-1 text-xs text-green-600">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                {connectedAccounts.length} account conness{connectedAccounts.length === 1 ? 'o' : 'i'}
              </div>
            ) : (
              <div className="text-xs text-gray-400">Non connesso</div>
            )}
          </div>
        </div>
        <button
          onClick={() => connectProvider(provider)}
          disabled={connecting === provider}
          className="relative z-10 flex items-center gap-1 text-sm font-medium text-gray-700 hover:text-brand border border-gray-200 px-3 py-1.5 rounded-lg hover:border-brand transition-colors disabled:opacity-50"
        >
          {connecting === provider ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          {connectedAccounts.length > 0 ? 'Connetti altro' : 'Connetti'}
        </button>
      </div>
      {connectedAccounts.map(acc => <AccountItem key={acc.id} account={acc} />)}
      {connectedAccounts.length === 0 && (
        <p className="text-xs text-gray-500">{description || `Connetti ${name} per ottenere risposte in bozza di alta qualità nel tuo tono e una inbox categorizzata.`}</p>
      )}
    </div>
  );

  return (
    <div className="px-8 py-6 max-w-3xl space-y-5">
      {/* Email */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-700">Email</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={loadAccounts}
              disabled={loading}
              className="inline-flex items-center gap-1 rounded-lg border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Aggiorna stato
            </button>
            <Info className="w-4 h-4 text-gray-400" />
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">Connetti email per ottenere <span className="text-brand font-medium">risposte in bozza di alta qualità</span> nel tuo tono e una inbox categorizzata.</p>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <ProviderCard icon={<img src="/assets/gmail.png" alt="Gmail" className="w-6 h-6 object-contain" />} name="Gmail" provider="google" connectedAccounts={googleAccounts} />
            <ProviderCard icon={<img src="/assets/outlook.png" alt="Outlook" className="w-6 h-6 object-contain" />} name="Outlook" provider="microsoft" connectedAccounts={microsoftAccounts} />
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-700">Calendario</h3>
          <Info className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mb-4">Connetti il calendario separatamente per suggerimenti disponibilita, scheduling link e notetaker su eventi reali.</p>
        <div className="grid grid-cols-2 gap-3">
          <ProviderCard icon={<img src="/assets/google-calendar.png" alt="Google Calendar" className="w-6 h-6 object-contain" />} name="Google Calendar" provider="google-calendar" connectedAccounts={googleCalendarAccounts} description="Connetti Google Calendar separatamente per notetaker, scheduling e partecipanti reali alle riunioni." />
          <ProviderCard icon={<img src="/assets/outlook.png" alt="Outlook Calendar" className="w-6 h-6 object-contain" />} name="Outlook Calendar" provider="microsoft-calendar" connectedAccounts={microsoftCalendarAccounts} description="Connetti Outlook Calendar separatamente per Teams links, suggerimenti disponibilita e sync riunioni." />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-700">Meeting providers</h3>
          <Info className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mb-4">Connetti Zoom per webhook meeting/recording e usa Teams/Google Calendar gia collegati per il notetaker.</p>
        <div className="grid grid-cols-2 gap-3">
          <ProviderCard icon="🎥" name="Zoom" provider="zoom" connectedAccounts={zoomAccounts} />
          <div className="border border-gray-100 rounded-xl p-4">
            <div className="text-sm font-semibold text-gray-900 mb-1">📅 Calendar support</div>
            <div className="text-xs text-gray-500">Google Calendar e Outlook Calendar sono gia usati da Pianificazione e Notetaker per eventi, partecipanti e join link.</div>
          </div>
        </div>
      </div>

      {/* PEC - Esclusivo Italia */}
      <div className="bg-white rounded-xl border border-brand/20 p-5 relative">
        <div className="absolute top-3 right-3 text-xs bg-brand text-white px-2 py-0.5 rounded font-medium">🇮🇹 Esclusivo Italia</div>
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-700">PEC (Posta Elettronica Certificata)</h3>
          <Info className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mb-4">Connetti il tuo account PEC per la gestione integrata con Gmail in un'unica inbox.</p>
        <div className="grid grid-cols-2 gap-3">
          {['Aruba PEC', 'Legalmail', 'Namirial', 'TIM PEC'].map(pec => (
            <div key={pec} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">📬 {pec}</div>
                <div className="text-xs text-gray-400">Non connesso</div>
              </div>
              <button className="text-sm font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Connetti</button>
            </div>
          ))}
        </div>
      </div>

      {/* Messaging */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Messaggistica</h3>
            <span className="text-xs text-brand border border-brand/30 px-1.5 py-0.5 rounded">Beta</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 mb-4">Invia automaticamente note riunioni, trascritti e action items al tuo team dopo ogni chiamata.</p>
        <div className="grid grid-cols-2 gap-3">
          {[{ icon: '💬', name: 'Microsoft Teams' }, { icon: '🎯', name: 'Slack' }].map(item => (
            <div key={item.name} className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-gray-900">{item.icon} {item.name}</div>
                <div className="text-xs text-gray-400">Non connesso</div>
              </div>
              <button className="text-sm font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Connetti</button>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2 rounded-t-xl">Domande Frequenti</h3>
        {faqs.map((faq, i) => (
          <div key={i} className="border-b border-gray-50 last:border-0">
            <button
              onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
              className="flex items-center justify-between w-full py-3 text-left"
            >
              <span className="text-sm text-gray-700">{faq}</span>
              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${expandedFaq === i ? 'rotate-180' : ''}`} />
            </button>
            {expandedFaq === i && (
              <div className="pb-3 text-xs text-gray-500">
                Questa funzionalità è attualmente in sviluppo. Contatta il supporto per maggiori informazioni.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
