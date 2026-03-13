import { useState } from 'react';
import { ChevronDown, ArrowRight, Check, Trash2, Info, Plus } from 'lucide-react';

const IntegrationCard = ({ icon, name, status, connectedEmail, connectedDate, onConnect }) => (
  <div className="border border-gray-100 rounded-xl p-4">
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{icon}</span>
        <div>
          <div className="text-sm font-semibold text-gray-900">{name}</div>
          {status === 'connected' ? (
            <div className="flex items-center gap-1 text-xs text-green-600"><div className="w-2 h-2 rounded-full bg-green-500" />1 account connesso</div>
          ) : (
            <div className="text-xs text-gray-400">Non connesso</div>
          )}
        </div>
      </div>
      <button onClick={onConnect} className="text-sm font-medium text-gray-700 hover:text-brand border border-gray-200 px-3 py-1.5 rounded-lg hover:border-brand transition-colors">
        {status === 'connected' ? 'Connetti altro' : 'Connetti'}
      </button>
    </div>
    {status === 'connected' && connectedEmail && (
      <div className="bg-gray-50 rounded-lg p-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-green-500" />
          <div>
            <div className="text-xs font-medium text-gray-700">{connectedEmail}</div>
            <div className="text-xs text-gray-400">Connesso {connectedDate}</div>
          </div>
        </div>
        <button className="text-gray-400 hover:text-red-500">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    )}
    {status !== 'connected' && (
      <p className="text-xs text-gray-500">Connetti {name} per ottenere risposte in bozza di alta qualità nel tuo tono e una inbox categorizzata.</p>
    )}
  </div>
);

const faqs = [
  'Cosa succede se ho già un sistema di etichette email?',
  'Cosa rappresentano le diverse categorie email?',
  'Il mio sistema tornerà alla normalità se non mi piace il prodotto?',
  'Come posso includere la mia firma email nelle bozze?',
  'Quando appariranno le mie bozze?',
  'Per utenti Microsoft - Perché le mie cartelle sono vuote?',
  'Come funziona la feature Calendario?',
  'Esiste un programma di referral?',
];

export default function Integrazioni() {
  const [expandedFaq, setExpandedFaq] = useState(null);

  return (
    <div className="px-8 py-6 max-w-3xl space-y-5">
      <div className="bg-[#f5f0e8] rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">👥</span>
          <div>
            <div className="text-sm font-semibold text-gray-900">Invita il tuo team</div>
            <div className="text-xs text-gray-500">MailMind AI diventa più intelligente quando i colleghi condividono il contesto.</div>
          </div>
        </div>
        <button className="flex items-center gap-1 text-sm text-brand font-medium whitespace-nowrap">
          Aggiungi colleghi <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Email */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-700">Email</h3>
          <Info className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mb-4">Connetti email per ottenere <span className="text-brand font-medium">risposte in bozza di alta qualità</span> nel tuo tono e una inbox categorizzata.</p>
        <div className="grid grid-cols-2 gap-3">
          <IntegrationCard icon="✉️" name="Gmail" status="connected" connectedEmail="utente@gmail.com" connectedDate="13 Mar 2026" onConnect={() => {}} />
          <IntegrationCard icon="📧" name="Outlook" status="disconnected" onConnect={() => {}} />
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

      {/* Calendar */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-700">Calendario</h3>
          <Info className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mb-4">Connetti il tuo calendario per gestire il tuo programma con l'AI.</p>
        <div className="grid grid-cols-2 gap-3">
          <IntegrationCard icon="📅" name="Google" status="connected" connectedEmail="utente@gmail.com" connectedDate="13 Mar 2026" onConnect={() => {}} />
          <IntegrationCard icon="📆" name="Outlook" status="disconnected" onConnect={() => {}} />
        </div>
      </div>

      {/* Messaging */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">Messaggistica</h3>
            <span className="text-xs text-brand border border-brand/30 px-1.5 py-0.5 rounded">Beta</span>
          </div>
          <Info className="w-4 h-4 text-gray-400" />
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

      {/* CRM */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-gray-700">CRM</h3>
            <span className="text-xs text-brand border border-brand/30 px-1.5 py-0.5 rounded">Beta</span>
          </div>
          <Info className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mb-4">Connetti il tuo CRM e lo aggiorneremo in base alle tue chiamate. <span className="font-medium">Dovrai essere admin per connetterlo.</span></p>
        <div className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">🟠 HubSpot</div>
            <div className="text-xs text-gray-400">Non connesso</div>
            <div className="text-xs text-gray-500 mt-1">Connetti HubSpot per aggiornare il tuo CRM con le registrazioni delle chiamate.</div>
          </div>
          <button className="text-sm font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Connetti</button>
        </div>
      </div>

      {/* Zoom */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-1">
          <h3 className="text-sm font-semibold text-gray-700">Zoom</h3>
          <Info className="w-4 h-4 text-gray-400" />
        </div>
        <p className="text-xs text-gray-500 mb-4">Collega Zoom per fare in modo che il notetaker si unisca automaticamente alle tue riunioni Zoom. <span className="text-brand">Google Meet e Teams funzionano senza setup.</span></p>
        <div className="border border-gray-100 rounded-xl p-4 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">🔵 Zoom</div>
            <div className="text-xs text-gray-400">Non connesso</div>
            <div className="text-xs text-gray-500 mt-1">Collega Zoom per il notetaker. Google Meet e Teams funzionano senza setup.</div>
          </div>
          <button className="text-sm font-medium text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg hover:bg-gray-50">Connetti</button>
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