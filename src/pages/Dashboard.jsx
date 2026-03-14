import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, ArrowRight, Copy, ChevronDown } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    stats: {
      emails_processed: 0,
      drafts_created: 0,
      meeting_hours: 0,
      connected_accounts: 0,
    },
    scheduling: null,
  });

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getDashboardSummary', {});
      setSummary(res.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  const stats = [
    { label: 'Email elaborate', value: loading ? '...' : String(summary.stats.emails_processed) },
    { label: 'Bozze create', value: loading ? '...' : String(summary.stats.drafts_created) },
    { label: 'Tempo riunioni', value: loading ? '...' : `${summary.stats.meeting_hours} h` },
  ];

  return (
    <div className="h-full overflow-auto bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Personale <ChevronDown className="w-3 h-3" />
          </button>
          <button onClick={loadSummary} className="p-1.5 hover:bg-gray-100 rounded-lg"><RefreshCw className="w-4 h-4 text-gray-500" /></button>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {stats.map(stat => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-sm text-gray-500 mb-2">{stat.label}</div>
              <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
            </div>
          ))}
        </div>

        {/* Meetings */}
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Le tue riunioni</h2>
          <div className="grid grid-cols-2 gap-4">
            {['Oggi', 'Domani'].map(day => (
              <div key={day} className="bg-white rounded-xl border border-gray-100 p-5 min-h-[100px] flex flex-col items-center justify-center">
                <p className="text-sm text-gray-400">Nessuna riunione {day.toLowerCase()}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scheduling link */}
        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 mb-1">Condividi il tuo link di pianificazione</h2>
              <p className="text-sm text-gray-500">MailMind AI usa questo link quando qualcuno chiede quando sei disponibile per una riunione. Puoi anche condividere questo link direttamente per permettere agli altri di prenotare un momento nel tuo calendario.</p>
            </div>
            <div className="flex-shrink-0 w-80">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg overflow-hidden mb-2">
                <input readOnly value={summary.scheduling?.url ? `${window.location.origin}${summary.scheduling.url}` : `${window.location.origin}/book/utente`} className="flex-1 px-3 py-2 text-sm text-gray-600 bg-transparent outline-none truncate" />
                <button className="flex items-center gap-1.5 bg-brand text-white px-3 py-2 text-sm font-medium hover:bg-brand/90 whitespace-nowrap">
                  <Copy className="w-3.5 h-3.5" /> Copia link <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              <Link to="/pianificazione" className="flex items-center gap-1 text-sm text-brand hover:underline">
                Aggiorna impostazioni riunione <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid grid-cols-2 gap-4">
          <Link to="/notetaker" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow overflow-hidden relative">
            <div className="h-24 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg mb-3 flex items-center justify-center">
              <span className="text-3xl">🎙️</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Sfoglia le tue note di riunione</h3>
            <p className="text-sm text-gray-500 mb-3">Guarda le registrazioni, leggi i trascritti completi e ottieni riassunti concisi</p>
            <span className="flex items-center gap-1 text-sm text-brand font-medium">Vedi note <ArrowRight className="w-4 h-4" /></span>
          </Link>
          <Link to="/categorizzazione" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow overflow-hidden relative">
            <div className="h-24 bg-gradient-to-br from-orange-100 to-red-50 rounded-lg mb-3 flex items-center justify-center">
              <span className="text-3xl">🏷️</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Personalizza la tua inbox</h3>
            <p className="text-sm text-gray-500 mb-3">Scegli cosa rimane visibile e archivia silenziosamente tutto il resto</p>
            <span className="flex items-center gap-1 text-sm text-brand font-medium">Gestisci categorie <ArrowRight className="w-4 h-4" /></span>
          </Link>
        </div>
      </div>
    </div>
  );
}