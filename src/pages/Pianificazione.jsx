import { useEffect, useMemo, useState } from 'react';
import { X, Copy, ArrowRight, Check } from 'lucide-react';
import { base44 } from '@/api/base44Client';

const Toggle = ({ checked, onChange }) => (
  <button onClick={() => onChange(!checked)} className={`w-10 h-6 rounded-full transition-all flex-shrink-0 relative ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}>
    <div className={`w-4 h-4 rounded-full bg-white shadow absolute top-1 transition-all ${checked ? 'left-5' : 'left-1'}`} />
  </button>
);

const hours = ['1AM','2AM','3AM','4AM','5AM','6AM','7AM','8AM','9AM','10AM','11AM','12PM','1PM','2PM','3PM','4PM','5PM','6PM','7PM','8PM','9PM','10PM','11PM'];
const days = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

export default function Pianificazione() {
  const [tab, setTab] = useState('links');
  const [showModal, setShowModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState('mailmind.ai/e/utente');
  const [availability, setAvailability] = useState([]);
  const [settings, setSettings] = useState({
    includeLink: true,
    generateDrafts: true,
    confirmation: true,
    timezone: 'Europe/Rome',
    meetingDuration: 30,
  });

  useEffect(() => {
    let active = true;

    base44.functions.invoke('getSchedulingSettings', {})
      .then((res) => {
        if (!active) return;
        const profile = res.data?.profile;
        const blocks = res.data?.availability || [];

        if (profile) {
          setSettings({
            includeLink: profile.include_link_in_drafts,
            generateDrafts: profile.generate_drafts_for_proposals,
            confirmation: profile.send_confirmation_emails,
            timezone: profile.timezone,
            meetingDuration: profile.meeting_duration_minutes,
          });
          setLink(`mailmind.ai/e/${profile.slug}`);
        }

        setAvailability(blocks);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const availableHours = useMemo(() => {
    const map = {};
    availability.filter((block) => block.is_active).forEach((block) => {
      const startHour = parseInt(block.start_time.split(':')[0], 10);
      const endHour = parseInt(block.end_time.split(':')[0], 10);
      map[block.day_of_week] = [];
      for (let hour = startHour; hour < endHour; hour += 1) {
        map[block.day_of_week].push(hour - 1);
      }
    });
    return map;
  }, [availability]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const slug = link.replace('mailmind.ai/e/', '').trim();
      const res = await base44.functions.invoke('saveSchedulingSettings', {
        slug,
        meeting_duration_minutes: settings.meetingDuration,
        timezone: settings.timezone,
        include_link_in_drafts: settings.includeLink,
        generate_drafts_for_proposals: settings.generateDrafts,
        send_confirmation_emails: settings.confirmation,
        availability_blocks: availability.map((block) => ({
          day_of_week: block.day_of_week,
          start_time: block.start_time,
          end_time: block.end_time,
          timezone: block.timezone,
          is_active: block.is_active,
        })),
      });

      if (res.data?.profile) {
        setLink(`mailmind.ai/e/${res.data.profile.slug}`);
      }
    } finally {
      setSaving(false);
      setShowModal(null);
    }
  };

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">Pianificazione</h1>
        <button onClick={handleSave} disabled={loading || saving} className="text-sm text-brand font-medium hover:underline disabled:opacity-50">{loading ? 'Caricamento...' : saving ? 'Salvataggio...' : 'Aggiorna preferenze'}</button>
      </div>

      <div className="px-8 py-6 max-w-4xl">
        <div className="flex gap-1 mb-6 border-b border-gray-100">
          {['links', 'drafts', 'availability'].map(t => (
            <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t === 'links' ? 'Link' : t === 'drafts' ? 'Bozze' : 'Disponibilità'}
            </button>
          ))}
        </div>

        {tab === 'links' && (
          <div>
            <div className="bg-[#f5f0e8] rounded-xl px-4 py-2 text-xs text-gray-500 mb-4">Ultimi 30 giorni</div>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[{ label: 'Riunioni prenotate', value: '0' }, { label: 'Partecipanti medi', value: '0.0' }, { label: 'Durata media', value: '0m' }].map(s => (
                <div key={s.label} className="bg-white rounded-xl border border-gray-100 p-4">
                  <div className="text-sm text-gray-500 mb-1">{s.label}</div>
                  <div className="text-2xl font-bold text-gray-900">{s.value}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-xl border border-gray-100 p-5 mb-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">Condividi il tuo link di pianificazione</h3>
                  <p className="text-sm text-gray-500">MailMind AI usa il link qui sotto quando qualcuno chiede quando sei disponibile. Puoi anche condividere questo link direttamente.</p>
                </div>
                <div className="flex-shrink-0 w-72">
                  <div className="flex items-center gap-1 border border-gray-200 rounded-lg overflow-hidden mb-2">
                    <input readOnly value={`${window.location.origin}/book/${link.replace('mailmind.ai/e/', '')}`} className="flex-1 px-2 py-2 text-xs text-gray-600 outline-none truncate" />
                    <button className="flex items-center gap-1 bg-brand text-white px-2 py-2 text-xs font-medium whitespace-nowrap">
                      <Copy className="w-3 h-3" /> Copia link
                    </button>
                  </div>
                  <button onClick={() => setShowModal('link')} className="flex items-center gap-1 text-sm text-brand hover:underline">
                    Aggiorna impostazioni <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="h-24 bg-[#f5f0e8] rounded-lg mb-3 flex items-center justify-center text-3xl">📅</div>
                <h3 className="font-semibold text-gray-900 mb-1">Ottimizza il tuo workflow di pianificazione</h3>
                <p className="text-xs text-gray-500 mb-2">Scopri come MailMind AI usa algoritmi intelligenti per suggerire orari ottimali per le riunioni.</p>
                <button className="flex items-center gap-1 text-sm text-brand font-medium">Scopri di più <ArrowRight className="w-3.5 h-3.5" /></button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-5">
                <div className="h-24 bg-[#f5f0e8] rounded-lg mb-3 flex items-center justify-center text-3xl">👥</div>
                <h3 className="font-semibold text-gray-900 mb-1">Pianificazione team</h3>
                <p className="text-xs text-gray-500 mb-2">Sfoglia la disponibilità del team e prenota riunioni con più partecipanti contemporaneamente.</p>
                <button className="flex items-center gap-1 text-sm text-brand font-medium">Gestisci team <ArrowRight className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          </div>
        )}

        {tab === 'drafts' && (
          <div className="max-w-lg space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Come MailMind AI risponde alle richieste di riunione</h3>
              {[
                { key: 'includeLink', label: 'Includi link di pianificazione nelle bozze', desc: 'MailMind AI includerà il tuo link di pianificazione nelle risposte in bozza quando viene rilevata una richiesta di riunione.' },
                { key: 'generateDrafts', label: 'Genera bozze per orari proposti', desc: 'MailMind AI genererà bozze quando qualcuno propone orari per riunioni.' },
                { key: 'confirmation', label: 'Email di conferma dopo proposta', desc: 'Riceverai un\'email quando qualcuno accetta un orario di riunione proposto.' },
              ].map(item => (
                <div key={item.key} className="border-b border-gray-50 last:border-0 pb-4 mb-4 last:mb-0 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{item.label}</span>
                    <Toggle checked={settings[item.key]} onChange={v => setSettings(s => ({ ...s, [item.key]: v }))} />
                  </div>
                  <p className="text-xs text-brand">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'availability' && (
          <div className="max-w-3xl space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-5">
              <h3 className="font-semibold text-gray-900 mb-2">Quando sei disponibile a incontrarti</h3>
              <p className="text-xs text-brand mb-4">Usato dal tuo link di pianificazione e da MailMind AI quando suggerisce orari nelle bozze.</p>
              <div className="mb-4">
                <div className="text-xs text-gray-500 mb-1">Fuso orario</div>
                <select value={settings.timezone} onChange={e => setSettings(s => ({ ...s, timezone: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm">
                  <option value="Europe/Rome">Ora dell'Europa Centrale</option>
                  <option value="Europe/London">Ora di Londra</option>
                  <option value="America/New_York">Ora di New York</option>
                </select>
              </div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Ore settimanali</h4>
              <p className="text-xs text-gray-400 mb-3">Trascina un giorno per impostare quando sei tipicamente disponibile. Clicca la X per rimuovere.</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <td className="w-12" />
                      {days.map(d => (
                        <th key={d} className={`text-center py-1 font-semibold ${d === 'Ven' ? 'text-brand' : 'text-gray-500'}`}>{d}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {hours.map((h, hi) => (
                      <tr key={h} className="border-t border-gray-50">
                        <td className="text-gray-400 text-right pr-2 py-0.5 w-12">{h}</td>
                        {days.map((d, di) => {
                          const isAvail = di < 5 && availableHours[di]?.includes(hi);
                          return (
                            <td key={d} className={`py-0.5 px-0.5 text-center ${isAvail ? 'bg-red-200' : ''}`}>
                              {isAvail && hi === 13 && <span className="text-gray-500">×</span>}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-2 mt-2">
                {days.slice(0,5).map(d => (
                  <div key={d} className="flex-1 text-center text-xs text-brand">9:00 - 17:00</div>
                ))}
                <div className="flex-1" />
                <div className="flex-1" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Link modal */}
      {showModal === 'link' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Rivendica il tuo link personale</h3>
              <button onClick={() => setShowModal(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Un link per permettere a chiunque di pianificare del tempo con te.</p>
            <div>
              <div className="text-xs text-gray-500 mb-1 border border-gray-200 rounded px-2 py-0.5 inline-block">Il tuo link di pianificazione</div>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden mt-1">
                <span className="px-3 py-2 text-sm text-gray-400 bg-gray-50">mailmind.ai/e/</span>
                <input value={link.replace('mailmind.ai/e/', '')} onChange={e => setLink('mailmind.ai/e/' + e.target.value)} className="flex-1 px-2 py-2 text-sm outline-none" />
                <Check className="w-4 h-4 text-green-500 mx-2" />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowModal(null)} className="text-sm text-gray-500 px-4 py-2">Salta</button>
              <button onClick={handleSave} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-semibold">Continua</button>
            </div>
          </div>
        </div>
      )}

      {showModal === 'linkReady' && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Il tuo link è pronto da condividere</h3>
              <button onClick={() => setShowModal(null)}><X className="w-4 h-4 text-gray-400" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Aggiungilo alla tua firma email, condividilo nei messaggi, o postalo su LinkedIn.</p>
            <div className="border border-gray-200 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900 text-sm">Riunione da 30 Minuti</div>
                <div className="text-xs text-gray-500">Il tuo nome</div>
              </div>
              <button className="flex items-center gap-1.5 bg-brand text-white px-3 py-2 rounded-lg text-xs font-medium">
                <Copy className="w-3.5 h-3.5" /> Copia link
              </button>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={() => setShowModal('link')} className="text-sm text-gray-500">Indietro</button>
              <button onClick={() => setShowModal(null)} className="text-sm font-medium text-gray-900">Fatto</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}