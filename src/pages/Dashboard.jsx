import { useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ChevronDown, ArrowRight } from 'lucide-react';

export default function Dashboard() {
  const [view, setView] = useState('personal');

  return (
    <div className="h-full overflow-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView(view === 'personal' ? 'organization' : 'personal')}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors border border-gray-200 rounded-lg px-3 py-1.5"
          >
            {view === 'personal' ? 'Personale' : 'Organizzazione'}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="p-6 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Email elaborate', value: '169' },
            { label: 'Bozze create', value: '12' },
            { label: 'Tempo riunioni', value: '3h' },
          ].map(stat => (
            <div key={stat.label} className="bg-cream rounded-xl border border-gray-200 p-5">
              <div className="text-xs text-gray-500 mb-2">{stat.label}</div>
              <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Meetings */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Le tue riunioni</h2>
          <div className="grid grid-cols-2 gap-4">
            {['Oggi', 'Domani'].map(day => (
              <div key={day} className="bg-cream rounded-xl border border-gray-200 p-5">
                <div className="text-xs font-semibold text-gray-600 mb-3">{day}</div>
                <div className="text-sm text-gray-400 text-center py-4">Nessuna riunione {day.toLowerCase()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Scheduling link */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Condividi il tuo link di pianificazione</h3>
            <p className="text-xs text-gray-500 mb-3">
              MailMind AI usa questo link quando qualcuno chiede la tua disponibilità.{' '}
              <a href="#" className="text-brand underline">Scopri di più</a>
            </p>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 truncate">
                https://app.mailmind.ai/m/utente/30
              </div>
            </div>
            <button className="mt-2 text-xs text-brand font-medium hover:underline flex items-center gap-1">
              Aggiorna impostazioni <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          <div />
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/notetaker" className="bg-cream rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <div className="h-20 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-lg mb-3 flex items-center justify-center">
              <span className="text-white font-black text-lg">〰️</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Sfoglia le note riunione</h3>
            <p className="text-xs text-gray-500 mb-2">Guarda le registrazioni, leggi le trascrizioni complete e ottieni sintesi concise</p>
            <span className="text-xs text-brand font-semibold flex items-center gap-1">
              Vedi le note <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
          <Link to="/categorizzazione" className="bg-cream rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition-colors">
            <div className="h-20 bg-gradient-to-r from-red-400 to-orange-400 rounded-lg mb-3 flex items-center justify-center">
              <span className="text-white font-black text-2xl">📬</span>
            </div>
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Personalizza la tua inbox</h3>
            <p className="text-xs text-gray-500 mb-2">Scegli cosa rimane visibile e archivia silenziosamente tutto il resto</p>
            <span className="text-xs text-brand font-semibold flex items-center gap-1">
              Gestisci categorie <ArrowRight className="w-3 h-3" />
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}