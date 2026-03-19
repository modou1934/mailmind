import { useEffect, useState } from "react";
import { CreditCard, ExternalLink, Pencil, BadgeEuro, ShieldCheck, Users } from "lucide-react";
import { api } from "@/api/privateApiClient";

export default function Fatturazione() {
  const [redirectingPlan, setRedirectingPlan] = useState("");
  const [billing, setBilling] = useState({
    planName: "STARTER",
    badge: "7 giorni gratis",
    price: "EUR20",
    cadence: "mese",
    teamSize: "1 seat",
    nextPayment: "-",
    billingInterval: "Mensile",
    cardMasked: "**** **** **** ****",
    monthlyPrice: "EUR20",
    annualPrice: "EUR192",
    professionalMonthlyPrice: "EUR40",
    professionalAnnualPrice: "EUR384",
    trialDays: 7,
  });

  useEffect(() => {
    const loadBilling = async () => {
      try {
        const payload = await api.get("/billing/summary");
        setBilling((current) => ({ ...current, ...payload }));
      } catch (error) {
        console.error("Failed to load billing", error);
      }
    };

    loadBilling();
  }, []);

  const startCheckout = async (tier, interval) => {
    setRedirectingPlan(`${tier}-${interval}`);
    try {
      const payload = await api.post("/billing/checkout", { tier, interval });
      if (payload.url) {
        window.location.href = payload.url;
        return;
      }
      throw new Error("Stripe checkout URL missing");
    } catch (error) {
      console.error("Failed to start checkout", error);
    } finally {
      setRedirectingPlan("");
    }
  };

  return (
    <div className="px-8 py-6 max-w-2xl space-y-4">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400"><BadgeEuro className="w-3.5 h-3.5" /> Piano</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">{billing.planName}</div>
          <div className="text-xs text-gray-500">Pacchetto attivo per inbox, calendari e notetaker.</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400"><Users className="w-3.5 h-3.5" /> Seats</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">{billing.teamSize}</div>
          <div className="text-xs text-gray-500">Dimensione workspace e margine per invitare il team.</div>
        </div>
        <div className="rounded-xl border border-gray-100 bg-white p-4">
          <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400"><ShieldCheck className="w-3.5 h-3.5" /> Stato</div>
          <div className="mt-2 text-lg font-semibold text-gray-900">{billing.badge}</div>
          <div className="text-xs text-gray-500">Indicatore rapido su trial, rinnovo o piano corrente.</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5 relative">
        <div className="absolute top-3 right-3 bg-yellow-100 text-yellow-700 text-xs font-semibold px-2 py-0.5 rounded-full">{billing.badge}</div>
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{billing.planName}</div>
        <div className="text-4xl font-black text-gray-900 mb-1">
          {billing.price.replace("EUR", "EUR ")} <span className="text-base font-normal text-gray-500">/ {billing.cadence}</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mt-3 mb-4 text-xs text-gray-500">
          <div><div className="text-gray-400">Dimensione team</div><div className="font-semibold text-gray-900">{billing.teamSize}</div></div>
          <div><div className="text-gray-400">Prossimo pagamento</div><div className="font-semibold text-gray-900">{billing.nextPayment}</div></div>
          <div><div className="text-gray-400">Fatturazione</div><div className="font-semibold text-gray-900">{billing.billingInterval}</div></div>
        </div>
        <div className="grid gap-3 md:grid-cols-2 text-sm">
          <button onClick={() => startCheckout("starter", "monthly")} disabled={redirectingPlan === "starter-monthly"} className="border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-left">{redirectingPlan === "starter-monthly" ? "Reindirizzamento..." : "Starter mensile €20"}</button>
          <button onClick={() => startCheckout("starter", "annual")} disabled={redirectingPlan === "starter-annual"} className="border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-left">{redirectingPlan === "starter-annual" ? "Reindirizzamento..." : "Starter annuale €192"}</button>
          <button onClick={() => startCheckout("professional", "monthly")} disabled={redirectingPlan === "professional-monthly"} className="border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-left">{redirectingPlan === "professional-monthly" ? "Reindirizzamento..." : "Professional mensile €40"}</button>
          <button onClick={() => startCheckout("professional", "annual")} disabled={redirectingPlan === "professional-annual"} className="border border-gray-200 px-3 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50 text-left">{redirectingPlan === "professional-annual" ? "Reindirizzamento..." : "Professional annuale €384"}</button>
        </div>
        <div className="mt-4 rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-500">
          Nuovo pricing: Starter €20/mese o €192/anno, Professional €40/mese o €384/anno, sempre con 7 giorni di prova iniziali.
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 bg-[#f5f0e8] -mx-5 px-5 py-2 rounded-t-xl">Metodo di pagamento</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-8 border border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <div className="text-sm text-gray-500">{billing.cardMasked}</div>
              <div className="text-xs text-gray-400">Carta in archivio nel backend privato</div>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1 text-sm text-brand font-medium hover:underline">
              Aggiorna <Pencil className="w-3.5 h-3.5" />
            </button>
            <button className="flex items-center gap-1 text-sm text-brand font-medium hover:underline">
              Vedi Fatture <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button className="text-sm text-gray-400 hover:text-gray-600 hover:underline">Annulla abbonamento</button>
      </div>
    </div>
  );
}
