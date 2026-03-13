import { useState } from 'react';
import { X, Copy, ChevronRight } from 'lucide-react';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
    style={{ height: '22px', width: '40px' }}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const days = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const hours = ['1AM','2AM','3AM','4AM','5AM','6AM','7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM','11PM'];

export default function Pianificazione() {
  const [tab, setTab] = useState('links');
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showReadyModal, setShowReadyModal] = useState(false);
  const [schedulingLink, setSchedulingLink] = useState('mailmind.ai/m/utente');
  const [settings, setSettings] = useState({
    includeSchedulingLink: true,
    generateDraftsForTimes: true,
    confirmationEmail: true,
  });

  const availability = {
    Lun: { active: true, times: ['10AM', '11AM', '12PM', '1PM', '3PM', '4PM', '5PM'] },
    Mar: { active: true, times: ['10AM', '11AM', '12PM', '1PM', '3PM', '4PM', '5PM'] },
    Mer: { active: true, times: ['10AM', '11AM', '12PM', '1PM', '3PM', '4PM', '5PM'] },
    Gio: { active: true, times: ['10AM', '11AM', '12PM', '1PM', '3PM', '4PM', '5PM'] },
    Ven: { active: true, times: ['10AM', '11AM', '12PM', '1PM', '3PM', '4PM', '5PM'] },
    Sab: { active: false, times: [] },
    Dom: { active: false, times: [] },
  };

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Pianificazione</h1>
        <button className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
          Aggiorna preferenze
        </button>
      </div>

      <div className="px-6 pt-5">
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          {['links', 'drafts', 'availability'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {{ links: 'Link', drafts: 'Bozze', availability: 'Disponibilità' }[t]}
            </button>
          ))}
        </div>

        {tab === 'links' && (
          <div className="max-w-4xl">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'Riunioni prenotate', value: '0' },
                { label: 'Partecipanti medi', value: '0.0' },
                { label: 'Durata media', value: '0m' },
              ].map(s => (
                <div key={s.label} className="bg-cream rounded-xl border border-gray-200 p-4">
                  <div className="text-xs text-gray-500 mb-1">Ultimi 30 giorni</div>
                  <div className="text-xs text-gray-400 mb-1">{s.label}</div>
                  <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                </div>
              ))}
            </div>

            {/* Scheduling link */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Condividi il tuo link di pianificazione</h3>
                <p className="text-xs text-gray-500 mb-3">
                  MailMind AI usa questo link quando qualcuno chiede la tua disponibilità.{' '}
                  <a href="#" className="text-brand underline">Puoi condividerlo</a> per far prenotare direttamente.
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-xs text-gray-600 truncate">
                    https://app.mailmind.ai/m/utente/30
                  </div>
                  <button
                    onClick={() => setShowClaimModal(true)}
                    className="flex items-center gap-1.5 bg-brand text-white px-3 py-2.5 rounded-lg text-xs font-semibold hover:bg-brand/90 whitespace-nowrap"
                  >
                    <Copy className="w-3 h-3" /> Copia link
                  </button>
                </div>
                <button className="text-xs text-brand font-semibold flex items-center gap-1 hover:underline">
                  Aggiorna impostazioni riunione <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Feature cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-cream rounded-xl border border-gray-200 p-5">
                <div className="h-20 bg-gradient-to-r from-purple-400 to-pink-400 rounded-lg mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Ottimizza il tuo workflow di pianificazione</h3>
                <p className="text-xs text-gray-500 mb-2">Scopri come MailMind AI usa algoritmi intelligenti per suggerire orari ottimali.</p>
                <button className="text-xs text-brand font-semibold flex items-center gap-1">
                  Scopri di più <ChevronRight className="w-3 h-3" />
                </button>
              </div>
              <div className="bg-cream rounded-xl border border-gray-200 p-5">
                <div className="h-20 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-lg mb-3" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">Pianificazione team</h3>
                <p className="text-xs text-gray-500 mb-2">Sfoglia la disponibilità del team e prenota riunioni con più partecipanti in una volta sola.</p>
                <button className="text-xs text-brand font-semibold flex items-center gap-1">
                  Gestisci team <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'drafts' && (
          <div className="max-w-2xl space-y-4">
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-xs font-semibold text-gray-900 mb-4">Come MailMind AI risponde alle richieste di riunione</h3>
              <div className="space-y-4">
                {[
                  { key: 'includeSchedulingLink', label: 'Includi link di pianificazione nelle bozze', desc: 'MailMind AI includerà il tuo link di pianificazione nelle risposte quando viene rilevata una richiesta di riunione.' },
                  { key: 'generateDraftsForTimes', label: 'Genera bozze per orari proposti', desc: 'MailMind AI genererà bozze quando qualcuno propone orari per una riunione.' },
                  { key: 'confirmationEmail', label: 'Email di conferma dopo proposta', desc: 'Riceverai un\'email quando qualcuno accetta un orario proposto.' },
                ].map(item => (
                  <div key={item.key} className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{item.label}</div>
                      <div className="text-xs text-brand mt-0.5">{item.desc}</div>
                    </div>
                    <Toggle checked={settings[item.key]} onChange={v => setSettings(p => ({ ...p, [item.key]: v }))} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'availability' && (
          <div className="max-w-4xl space-y-4">
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Quando sei disponibile per le riunioni</h3>
              <p className="text-xs text-brand mb-4">Usato dal tuo link di pianificazione e da MailMind AI per suggerire orari nelle bozze.</p>
              <div className="mb-4">
                <label className="text-xs text-gray-500 mb-1 block">Fuso orario</label>
                <select className="w-full max-w-xs border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none">
                  <option>Ora dell'Europa Centrale (CET)</option>
                  <option>UTC</option>
                  <option>America/New_York</option>
                </select>
              </div>
              <div>
                <div className="text-xs font-medium text-gray-600 mb-2">Orari settimanali</div>
                <p className="text-xs text-gray-400 mb-3">Trascina su un giorno per impostare la tua disponibilità. Clicca la X per rimuovere.</p>
                <div className="overflow-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr>
                        <td className="w-12 py-1" />
                        {days.map(d => (
                          <th key={d} className={`text-center py-1 font-medium px-1 ${availability[d]?.active ? 'text-gray-700' : 'text-gray-300'}`}>
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {hours.map(hour => (
                        <tr key={hour}>
                          <td className="text-gray-400 pr-2 py-px text-right">{hour}</td>
                          {days.map(d => {
                            const isAvailable = availability[d]?.active && availability[d].times.includes(hour);
                            const isMidDay = hour === '1PM';
                            return (
                              <td key={d} className="px-0.5 py-px">
                                <div className={`h-5 rounded-sm cursor-pointer transition-colors ${
                                  isAvailable
                                    ? isMidDay
                                      ? 'bg-red-200 flex items-center justify-center'
                                      : 'bg-red-300'
                                    : 'hover:bg-gray-100'
                                }`}>
                                  {isAvailable && isMidDay && <span className="text-white text-[9px]">×</span>}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Claim link modal */}
      {showClaimModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Personalizza il tuo link</h3>
              <button onClick={() => setShowClaimModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Un link per far prenotare a tutti il loro tempo con te. Personalizzalo per renderlo facile da ricordare.</p>
            <div className="mb-4">
              <label className="text-xs text-gray-500 mb-1 block">Il tuo link di pianificazione</label>
              <input
                type="text"
                value={schedulingLink}
                onChange={e => setSchedulingLink(e.target.value)}
                className="w-full border border-brand rounded-lg px-3 py-2.5 text-sm text-gray-700 focus:outline-none"
              />
              <div className="flex justify-end mt-1">
                <span className="text-xs text-green-500 font-medium">✓</span>
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowClaimModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Salta</button>
              <button onClick={() => { setShowClaimModal(false); setShowReadyModal(true); }} className="flex-1 py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand/90">Continua</button>
            </div>
          </div>
        </div>
      )}

      {/* Link ready modal */}
      {showReadyModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Il tuo link è pronto</h3>
              <button onClick={() => setShowReadyModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Aggiungilo alla tua firma email, condividilo nei messaggi, o pubblicalo su LinkedIn.</p>
            <div className="flex items-center justify-between border border-gray-200 rounded-xl p-3 mb-4">
              <div>
                <div className="text-sm font-semibold text-gray-900">Riunione 30 Minuti</div>
                <div className="text-xs text-gray-500">Utente MailMind</div>
              </div>
              <button className="flex items-center gap-1.5 text-brand text-sm font-semibold">
                <Copy className="w-3.5 h-3.5" /> Copia link
              </button>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowReadyModal(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50">Indietro</button>
              <button onClick={() => setShowReadyModal(false)} className="flex-1 py-2.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800">Fatto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}