import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { RefreshCw, ArrowRight, Copy, ChevronDown } from "lucide-react";
import { api } from "@/api/privateApiClient";

export default function Dashboard() {
  const [stats, setStats] = useState([
    { label: "Email elaborate", value: "0" },
    { label: "Bozze create", value: "0" },
    { label: "Tempo riunioni", value: "0 h" },
  ]);
  const [meetings, setMeetings] = useState({ today: [], tomorrow: [] });
  const [schedulingLink, setSchedulingLink] = useState("https://mailmind.ai/e/utente/30");
  const [awaitingReplies, setAwaitingReplies] = useState([]);

  const loadDashboard = async () => {
    try {
      const [dashboardPayload, schedulingPayload, awaitingReplyPayload] = await Promise.all([
        api.get("/dashboard"),
        api.get("/settings/scheduling"),
        api.get("/mail/awaiting-reply"),
      ]);

      setStats(dashboardPayload.stats || []);
      setMeetings(dashboardPayload.meetings || { today: [], tomorrow: [] });

      const scheduling = schedulingPayload.value || {};
      if (scheduling.link) {
        setSchedulingLink(`https://${scheduling.link}/30`);
      }
      setAwaitingReplies(awaitingReplyPayload.threads || []);
    } catch (error) {
      console.error("Failed to load dashboard", error);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Dashboard</h1>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
            Personale <ChevronDown className="w-3 h-3" />
          </button>
          <button onClick={loadDashboard} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <RefreshCw className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl">
        <div className="grid grid-cols-3 gap-4 mb-6">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 p-5">
              <div className="text-sm text-gray-500 mb-2">{stat.label}</div>
              <div className="text-3xl font-bold text-gray-900">{stat.value}</div>
            </div>
          ))}
        </div>

        <div className="mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Le tue riunioni</h2>
          <div className="grid grid-cols-2 gap-4">
            {[
              { key: "today", label: "Oggi" },
              { key: "tomorrow", label: "Domani" },
            ].map((day) => (
              <div
                key={day.key}
                className="bg-white rounded-xl border border-gray-100 p-5 min-h-[100px] flex flex-col items-center justify-center"
              >
                {meetings[day.key]?.length ? (
                  meetings[day.key].map((meeting) => (
                    <div key={meeting.id} className="w-full text-left">
                      <div className="text-sm font-medium text-gray-900">{meeting.title}</div>
                      <div className="text-xs text-gray-500">{meeting.time}</div>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-gray-400">Nessuna riunione {day.label.toLowerCase()}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1">
              <h2 className="font-semibold text-gray-900 mb-1">Condividi il tuo link di pianificazione</h2>
              <p className="text-sm text-gray-500">
                MailMind AI usa questo link quando qualcuno chiede quando sei disponibile per una
                riunione. Puoi anche condividerlo direttamente.
              </p>
            </div>
            <div className="flex-shrink-0 w-80">
              <div className="flex items-center gap-2 border border-gray-200 rounded-lg overflow-hidden mb-2">
                <input
                  readOnly
                  value={schedulingLink}
                  className="flex-1 px-3 py-2 text-sm text-gray-600 bg-transparent outline-none truncate"
                />
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

        <div className="bg-white rounded-xl border border-gray-100 p-5 mb-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="font-semibold text-gray-900 mb-1">In attesa di risposta</h2>
              <p className="text-sm text-gray-500">Thread che hai gia' gestito ma che meritano un follow-up.</p>
            </div>
            <Link to="/bozze" className="text-sm font-medium text-brand hover:underline">Apri pipeline bozze</Link>
          </div>
          {awaitingReplies.length ? (
            <div className="space-y-3">
              {awaitingReplies.slice(0, 4).map((thread) => (
                <div key={thread.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-gray-900">{thread.subject}</div>
                      <div className="text-xs text-gray-500">{thread.from_name || thread.from_email} • follow-up dopo {thread.waiting_days} giorni</div>
                    </div>
                    <span className="rounded-full bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700">
                      Awaiting reply
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Nessun follow-up urgente: la coda awaiting reply e' vuota.</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Link to="/notetaker" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow overflow-hidden relative">
            <div className="h-24 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg mb-3 flex items-center justify-center">
              <span className="text-3xl">🎙️</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Sfoglia le tue note di riunione</h3>
            <p className="text-sm text-gray-500 mb-3">Guarda registrazioni, trascritti e riepiloghi privati.</p>
            <span className="flex items-center gap-1 text-sm text-brand font-medium">Vedi note <ArrowRight className="w-4 h-4" /></span>
          </Link>
          <Link to="/categorizzazione" className="bg-white rounded-xl border border-gray-100 p-5 hover:shadow-md transition-shadow overflow-hidden relative">
            <div className="h-24 bg-gradient-to-br from-orange-100 to-red-50 rounded-lg mb-3 flex items-center justify-center">
              <span className="text-3xl">🏷️</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Personalizza la tua inbox</h3>
            <p className="text-sm text-gray-500 mb-3">Scegli cosa rimane visibile e archivia il resto nel tuo backend privato.</p>
            <span className="flex items-center gap-1 text-sm text-brand font-medium">Gestisci categorie <ArrowRight className="w-4 h-4" /></span>
          </Link>
        </div>
      </div>
    </div>
  );
}
