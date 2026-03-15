import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { api } from "@/api/privateApiClient";

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${checked ? "bg-gray-900" : "bg-gray-300"}`}
  >
    <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${checked ? "left-5" : "left-1"}`} />
  </button>
);

export default function Organizzazione() {
  const [settings, setSettings] = useState({ autoAdd: true, discoverable: true });
  const [orgName, setOrgName] = useState("Il mio Studio");
  const [orgDomain, setOrgDomain] = useState("");

  useEffect(() => {
    const loadWorkspace = async () => {
      try {
        const payload = await api.get("/workspace");
        setOrgName(payload.orgName || "Il mio Studio");
        setOrgDomain(payload.orgDomain || "");
        setSettings(payload.settings || { autoAdd: true, discoverable: true });
      } catch (error) {
        console.error("Failed to load workspace", error);
      }
    };

    loadWorkspace();
  }, []);

  const saveWorkspace = async () => {
    try {
      await api.patch("/workspace", {
        orgName,
        orgDomain,
        settings,
      });
    } catch (error) {
      console.error("Failed to save workspace", error);
    }
  };

  return (
    <div className="px-8 py-6 max-w-2xl space-y-4">
      <div className="bg-[#f5f0e8] rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg">👥</span>
          <div>
            <div className="text-sm font-semibold text-gray-900">Invita il tuo team</div>
            <div className="text-xs text-gray-500">MailMind AI diventa piu intelligente quando i colleghi condividono il contesto.</div>
          </div>
        </div>
        <button className="flex items-center gap-1 text-sm text-brand font-medium hover:underline whitespace-nowrap">
          Aggiungi colleghi <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2 rounded-t-xl">Dettagli Organizzazione</h3>
        <div className="space-y-3">
          <div>
            <div className="text-xs text-gray-500 mb-1 border border-gray-100 px-2 py-0.5 rounded inline-block">Nome Organizzazione</div>
            <input value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1 border border-gray-100 px-2 py-0.5 rounded inline-block">Dominio Organizzazione</div>
            <input value={orgDomain} onChange={(e) => setOrgDomain(e.target.value)} placeholder="esempio.com" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1" />
            <p className="text-xs text-gray-400 mt-1">I colleghi con questo dominio email possono entrare automaticamente nell'organizzazione.</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2 rounded-t-xl">Membri & Accesso</h3>
        {[
          { key: "autoAdd", label: "Aggiungi automaticamente utenti per questo dominio", desc: "I colleghi con il tuo dominio email entreranno automaticamente quando si iscrivono a MailMind AI" },
          { key: "discoverable", label: "Organizzazione ricercabile", desc: "I nuovi colleghi vedranno questa organizzazione quando si iscrivono con il tuo dominio", highlight: true },
        ].map((item) => (
          <div key={item.key} className={`flex items-start justify-between py-3 border-b border-gray-50 last:border-0 ${item.highlight && settings[item.key] ? "bg-blue-50 -mx-5 px-5 rounded" : ""}`}>
            <div>
              <div className="text-sm font-medium text-gray-900">{item.label}</div>
              <div className={`text-xs ${item.highlight ? "text-brand" : "text-gray-500"}`}>{item.desc}</div>
            </div>
            <Toggle checked={settings[item.key]} onChange={(value) => setSettings((current) => ({ ...current, [item.key]: value }))} />
          </div>
        ))}
      </div>

      <div className="flex justify-end">
        <button onClick={saveWorkspace} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand/90">
          Salva impostazioni private
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2 rounded-t-xl">Zona Pericolosa</h3>
        <p className="text-xs text-gray-500 mb-3">Azioni irreversibili per la tua organizzazione</p>
        <div className="flex gap-3">
          <button className="border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-50">Lascia organizzazione</button>
          <button className="border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm hover:bg-red-50">Elimina organizzazione</button>
        </div>
      </div>
    </div>
  );
}
