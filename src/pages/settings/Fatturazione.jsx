export default function Fatturazione() {
  return (
    <div className="p-6 max-w-2xl">
      <div className="bg-cream rounded-xl border border-gray-200 p-6 mb-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">PIANO PRO</div>
            <div className="text-4xl font-black text-gray-900">€39.00 <span className="text-base font-normal text-gray-500">/ mese</span></div>
          </div>
          <span className="text-xs bg-yellow-100 text-yellow-700 font-bold px-2 py-1 rounded-full">● Prova</span>
        </div>
        <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
          <div>
            <div className="text-xs text-gray-500">Dimensione team</div>
            <div className="font-semibold text-gray-900">1 utente</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Prossimo pagamento</div>
            <div className="font-semibold text-gray-900">—</div>
          </div>
          <div>
            <div className="text-xs text-gray-500">Fatturazione</div>
            <div className="font-semibold text-gray-900">Mensile</div>
          </div>
        </div>
        <div className="flex gap-3">
          <button className="text-sm text-gray-600 hover:text-gray-900 font-medium border border-gray-300 rounded-lg px-3 py-1.5">
            Passa a Solo
          </button>
          <button className="text-sm text-gray-600 hover:text-gray-900 font-medium border border-gray-300 rounded-lg px-3 py-1.5">
            Passa ad annuale
          </button>
          <button className="text-sm text-brand hover:underline font-medium flex items-center gap-1">
            Gestisci team 👥
          </button>
        </div>
      </div>

      <div className="bg-cream rounded-xl border border-gray-200 p-5 mb-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Metodo di pagamento</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-7 bg-yellow-400 rounded flex items-center justify-center text-[10px] font-bold">VISA</div>
            <div>
              <div className="text-sm font-medium text-gray-900">•••• •••• •••• ••••</div>
              <div className="text-xs text-gray-500">Carta in archivio</div>
            </div>
          </div>
          <div className="flex gap-3">
            <button className="text-sm text-brand font-medium hover:underline flex items-center gap-1">
              Modifica ✏️
            </button>
            <button className="text-sm text-brand font-medium hover:underline flex items-center gap-1">
              Vedi Fatture ↗
            </button>
          </div>
        </div>
      </div>

      <div className="text-center">
        <button className="text-sm text-gray-500 hover:text-red-600 transition-colors">
          Annulla abbonamento
        </button>
      </div>
    </div>
  );
}