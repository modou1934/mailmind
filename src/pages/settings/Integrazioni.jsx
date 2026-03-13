import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const IntegrationCard = ({ icon, name, status, connected, email, date, onConnect }) => (
  <div className="border border-gray-200 rounded-xl p-4 bg-white">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-2">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="text-sm font-semibold text-gray-900">{name}</div>
          {connected ? (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              {connected} account connesso{connected > 1 ? 'i' : ''}
            </div>
          ) : (
            <div className="text-xs text-gray-400">Non connesso</div>
          )}
        </div>
      </div>
      <button
        onClick={onConnect}
        className="text-sm font-semibold text-brand hover:underline"
      >
        {connected ? 'Connetti un altro' : 'Connetti'}
      </button>
    </div>
    {email && (
      <div className="bg-gray-50 rounded-lg px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-green-500 flex items-center justify-center">
            <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
          <span className="text-xs text-gray-700">{email}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">Connesso {date}</span>
          <button className="text-gray-400 hover:text-red-500">🗑️</button>
        </div>
      </div>
    )}
    {!connected && status && (
      <p className="text-xs text-brand mt-2">{status}</p>
    )}
  </div>
);

const faqItems = [
  'Ho già un sistema di etichette email?',
  'Cosa rappresentano le categorie email?',
  'Il mio sistema tornerà alla normalità se non mi piace il prodotto?',
  'Come posso includere la mia firma email nelle bozze?',
  'Quando appariranno le mie bozze?',
  'Per utenti Microsoft - Perché le mie cartelle sono vuote?',
  'Come funziona la funzione Calendario?',
  'Esiste uno schema di riferimento?',
];

export default function Integrazioni() {
  const [openFaq, setOpenFaq] = useState(null);

  return (
    <div className="p-6 max-w-3xl space-y-5">
      {/* Invite banner */}
      <div className="bg-cream rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">👥</span>
          <div>
            <div className="text-sm font-semibold text-gray-900">Invita il tuo team</div>
            <div className="text-xs text-gray-500">MailMind AI diventa più intelligente quando i colleghi condividono il contesto. Invitali a collaborare.</div>
          </div>
        </div>
        <button className="text-sm font-semibold text-brand flex items-center gap-1 whitespace-nowrap hover:underline">
          Aggiungi colleghi →
        </button>
      </div>

      {/* Email */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Email</h3>
            <p className="text-xs text-gray-500">Connetti email per ottenere <span className="text-brand">risposte bozza di alta qualità</span> nel tuo stile e una inbox categorizzata.</p>
          </div>
          <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center">?</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <IntegrationCard
            icon="M" name="Gmail" connected={1}
            email="utente@gmail.com" date="11 Mar 2026"
          />
          <IntegrationCard
            icon="O" name="Outlook"
            status="Connetti Outlook per risposte bozza di alta qualità nel tuo stile e una inbox categorizzata."
          />
        </div>
      </div>

      {/* PEC (Italian exclusive) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">PEC</h3>
          <span className="text-xs bg-brand/10 text-brand font-bold rounded px-2 py-0.5">Solo Italia 🇮🇹</span>
          <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center ml-auto">?</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[
            { icon: '📮', name: 'Aruba PEC' },
            { icon: '⚖️', name: 'Legalmail' },
            { icon: '🔐', name: 'Namirial' },
            { icon: '📡', name: 'TIM PEC' },
          ].map(pec => (
            <div key={pec.name} className="border border-gray-200 rounded-xl p-4 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{pec.icon}</span>
                <div className="text-sm font-semibold text-gray-900">{pec.name}</div>
              </div>
              <button className="text-sm font-semibold text-brand hover:underline">Connetti</button>
            </div>
          ))}
        </div>
      </div>

      {/* Calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Calendario</h3>
            <p className="text-xs text-gray-500">Connetti il tuo calendario per gestire il tuo programma con l'AI.</p>
          </div>
          <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center">?</button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <IntegrationCard
            icon="📅" name="Google Calendar" connected={1}
            email="utente@gmail.com" date="11 Mar 2026"
          />
          <IntegrationCard
            icon="O" name="Outlook Calendar"
            status="Connetti Outlook per gestire il tuo programma con l'AI."
          />
        </div>
      </div>

      {/* Messaging */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-900">Messaggistica</h3>
            <span className="text-xs bg-brand/10 text-brand font-bold rounded px-2 py-0.5">Beta</span>
          </div>
          <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center">?</button>
        </div>
        <p className="text-xs text-gray-500 mb-3">Invia automaticamente note riunione, trascrizioni e action items al tuo team dopo ogni chiamata.</p>
        <div className="grid grid-cols-2 gap-3">
          <IntegrationCard icon="💼" name="Microsoft Teams" />
          <IntegrationCard icon="💬" name="Slack" />
        </div>
      </div>

      {/* CRM */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h3 className="text-sm font-semibold text-gray-900">CRM</h3>
          <span className="text-xs bg-brand/10 text-brand font-bold rounded px-2 py-0.5">Beta</span>
          <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center ml-auto">?</button>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🧡</span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-gray-900">HubSpot</div>
                <button className="text-sm font-semibold text-brand hover:underline">Connetti</button>
              </div>
              <div className="text-xs text-gray-400 mb-1">Non connesso</div>
              <p className="text-xs text-gray-500">Connetti HubSpot per aggiornare il CRM con le registrazioni delle chiamate, trascrizioni e note, e creare nuovi deal in base alle riunioni prenotate.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Zoom */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Zoom</h3>
          <button className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs flex items-center justify-center">?</button>
        </div>
        <div className="border border-gray-200 rounded-xl p-4 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔵</span>
              <div>
                <div className="text-sm font-semibold text-gray-900">Zoom</div>
                <div className="text-xs text-gray-400">Non connesso</div>
              </div>
            </div>
            <button className="text-sm font-semibold text-brand hover:underline">Connetti</button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Collega Zoom per far partecipare automaticamente il notetaker alle tue riunioni Zoom. Google Meet e Teams funzionano{' '}
            <span className="text-brand">senza configurazione</span>.
          </p>
        </div>
      </div>

      {/* FAQ */}
      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Domande frequenti</h3>
        </div>
        {faqItems.map((q, i) => (
          <div key={i} className="border-b border-gray-100 last:border-0">
            <button
              onClick={() => setOpenFaq(openFaq === i ? null : i)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 text-left"
            >
              {q}
              <ChevronDown className={`w-4 h-4 text-gray-400 flex-shrink-0 ml-2 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} />
            </button>
            {openFaq === i && (
              <div className="px-4 pb-3 text-xs text-gray-500">
                Per informazioni dettagliate su questa funzionalità, visita la nostra documentazione o contatta il supporto italiano.
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}