import { useState } from 'react';
import { ChevronDown, Minus, Plus, X } from 'lucide-react';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
  >
    <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${checked ? 'left-5' : 'left-1'}`} />
  </button>
);

export default function Bozze() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState({
    enableDrafts: true,
    deleteDays: 14,
    followUpEnabled: true,
    followUpDays: 3,
    customInstructions: false,
    includeSignatures: true,
  });
  const [responseStyle, setResponseStyle] = useState('I reply to almost everything, even just to be polite');
  const [showEmailModal, setShowEmailModal] = useState(false);

  const adjust = (key, delta) => {
    setSettings(s => ({ ...s, [key]: Math.max(1, s[key] + delta) }));
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Bozze</h1>
        <button className="text-sm text-brand font-medium hover:underline">Aggiorna preferenze</button>
      </div>

      <div className="px-8 py-6 max-w-2xl">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          {['general', 'signatures', 'customFiles'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              {t === 'general' ? 'Generale' : t === 'signatures' ? 'Firme' : 'File Personalizzati'}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Impostazioni Bozze</h3>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita risposte in bozza</div>
                  <div className="text-xs text-brand">Genera automaticamente risposte in bozza per le email in arrivo</div>
                </div>
                <Toggle checked={settings.enableDrafts} onChange={v => setSettings(s => ({ ...s, enableDrafts: v }))} />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">Le bozze inutilizzate vengono eliminate dopo</div>
                <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 w-fit">
                  <button onClick={() => adjust('deleteDays', -1)} className="text-gray-400 hover:text-gray-700"><Minus className="w-4 h-4" /></button>
                  <span className="text-sm font-medium text-gray-900 w-16 text-center">{settings.deleteDays} giorni</span>
                  <button onClick={() => adjust('deleteDays', 1)} className="text-gray-400 hover:text-gray-700"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Stile di Risposta</h3>
              <div className="text-xs text-gray-500 mb-2">Con quale frequenza ti piace rispondere?</div>
              <div className="relative">
                <select
                  value={responseStyle}
                  onChange={e => setResponseStyle(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white appearance-none pr-8"
                >
                  <option>Rispondo a quasi tutto, anche solo per essere cortese</option>
                  <option>Rispondo solo quando necessario</option>
                  <option>Rispondo raramente a email non urgenti</option>
                </select>
                <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Follow-up</h3>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-50">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita bozze di follow-up</div>
                  <div className="text-xs text-brand">Bozza automaticamente email di follow-up quando non hai ricevuto risposta</div>
                </div>
                <Toggle checked={settings.followUpEnabled} onChange={v => setSettings(s => ({ ...s, followUpEnabled: v }))} />
              </div>
              <div>
                <div className="text-xs text-gray-500 mb-2">Giorni prima del follow-up</div>
                <div className="flex items-center gap-3 border border-gray-200 rounded-lg px-3 py-2 w-fit">
                  <button onClick={() => adjust('followUpDays', -1)} className="text-gray-400 hover:text-gray-700"><Minus className="w-4 h-4" /></button>
                  <span className="text-sm font-medium text-gray-900 w-16 text-center">{settings.followUpDays} giorni</span>
                  <button onClick={() => adjust('followUpDays', 1)} className="text-gray-400 hover:text-gray-700"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Tono Personalizzato</h3>
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita istruzioni personalizzate</div>
                  <div className="text-xs text-gray-500">Aggiungi istruzioni personalizzate per guidare come vengono scritte le bozze</div>
                </div>
                <Toggle checked={settings.customInstructions} onChange={v => setSettings(s => ({ ...s, customInstructions: v }))} />
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Impostazioni Font</h3>
              <div className="space-y-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">Famiglia Font</div>
                  <div className="relative">
                    <select className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white appearance-none pr-8">
                      <option>Gmail/Outlook default</option>
                    </select>
                    <ChevronDown className="w-4 h-4 text-gray-400 absolute right-2 top-2.5 pointer-events-none" />
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Dimensione Font</div>
                  <input type="number" defaultValue={0} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <div className="text-xs text-gray-400 mt-1">Imposta a 0 per ereditare la dimensione dal tuo client email.</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">Colore Font</div>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="w-6 h-6 rounded bg-gray-900" />
                    <span className="text-sm text-gray-700">#111111</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Threading Email</h3>
              <p className="text-xs text-gray-500 mb-3">Per il funzionamento fluido delle bozze, Gmail o Outlook dovrebbero raggruppare le email correlate in un unico thread.</p>
              {['Come abilitare il threading in Gmail', 'Come abilitare il threading in Outlook'].map(item => (
                <div key={item} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0 cursor-pointer hover:bg-gray-50 -mx-5 px-5">
                  <span className="text-sm text-gray-700">{item}</span>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'signatures' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Impostazioni Organizzazione</h3>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">Includi firme email nelle bozze</div>
                  <div className="text-xs text-gray-500">Disabilita se la tua organizzazione aggiunge firme automaticamente</div>
                </div>
                <Toggle checked={settings.includeSignatures} onChange={v => setSettings(s => ({ ...s, includeSignatures: v }))} />
              </div>
              <p className="text-xs text-gray-400">Useremo prima la tua firma specifica per account. Se non ne hai impostata una, useremo la tua firma predefinita.</p>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Firma Predefinita</h3>
              <textarea className="w-full border border-gray-200 rounded-lg p-3 text-sm h-28 resize-none" placeholder="Incolla la tua firma qui" />
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Firme Specifiche per Account</h3>
              <div className="text-xs text-brand mb-2">utente@gmail.com</div>
              <textarea className="w-full border border-gray-200 rounded-lg p-3 text-sm h-20 resize-none" placeholder="Incolla firma qui" />
            </div>
          </div>
        )}

        {tab === 'customFiles' && (
          <div className="space-y-4">
            {showEmailModal && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
                <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-bold text-gray-900">Carica File via Email</h3>
                    <button onClick={() => setShowEmailModal(false)}><X className="w-4 h-4 text-gray-400" /></button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">Invia i tuoi PDF, CSV o file Excel come allegati a <span className="font-medium text-brand">ai@mailmind.it</span> e scrivi solo <em>upload</em> nel corpo. Li aggiungeremo automaticamente e ti avviseremo quando sono pronti.</p>
                  <button onClick={() => setShowEmailModal(false)} className="w-full bg-brand text-white py-3 rounded-xl font-semibold">Capito</button>
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Carica File</h3>
              <p className="text-xs text-gray-500 mb-4">Carica documenti a cui MailMind AI può fare riferimento durante la bozza delle tue email.</p>
              <div
                onClick={() => setShowEmailModal(true)}
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-brand hover:bg-brand/5 transition-colors"
              >
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <span className="text-xl">📄</span>
                </div>
                <div className="text-sm font-medium text-gray-700 mb-1">Trascina i file qui</div>
                <div className="text-xs text-gray-400">o clicca per sfogliare · PDF, CSV · Max 10MB ciascuno</div>
                <button className="mt-2 text-sm text-brand font-medium">Scegli file</button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">I tuoi File</h3>
              <div className="bg-gray-50 rounded-lg p-8 text-center">
                <div className="text-2xl mb-2">📄</div>
                <div className="text-sm text-gray-500 font-medium">Nessun file caricato ancora</div>
                <div className="text-xs text-gray-400">Carica documenti per aiutare MailMind AI a bozzare risposte migliori</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}