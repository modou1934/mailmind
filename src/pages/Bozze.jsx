import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

const Toggle = ({ checked, onChange }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`relative rounded-full transition-colors flex-shrink-0 ${checked ? 'bg-gray-900' : 'bg-gray-300'}`}
    style={{ height: '22px', width: '40px' }}
  >
    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
  </button>
);

const Counter = ({ value, onChange, min = 1, max = 30 }) => (
  <div className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg p-2 w-48">
    <button
      onClick={() => onChange(Math.max(min, value - 1))}
      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 font-bold"
    >−</button>
    <span className="flex-1 text-center text-sm font-medium text-gray-900">{value} giorni</span>
    <button
      onClick={() => onChange(Math.min(max, value + 1))}
      className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-gray-200 text-gray-600 font-bold"
    >+</button>
  </div>
);

export default function Bozze() {
  const [tab, setTab] = useState('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingSignatures, setSavingSignatures] = useState(false);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [accounts, setAccounts] = useState([]);
  const [accountSignatures, setAccountSignatures] = useState({});
  const [referenceFiles, setReferenceFiles] = useState([]);
  const [settings, setSettings] = useState({
    enableDrafts: true,
    unusedDraftsDays: 14,
    responseStyle: 'everything',
    enableFollowUps: true,
    followUpDays: 3,
    customTone: false,
    customToneText: '',
    fontFamily: 'Gmail/Outlook default',
    fontSize: 0,
    fontColor: '#111111',
    includeSignature: true,
    defaultSignature: '',
    showThreadingGmail: false,
    showThreadingOutlook: false,
  });

  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadDraftAssets = async () => {
    const res = await base44.functions.invoke('getDraftAssets', {});
    const signaturesMap = Object.fromEntries((res.data?.signatures || []).map((item) => [item.email, item.signature_content || '']));
    setAccounts(res.data?.accounts || []);
    setAccountSignatures(signaturesMap);
    setReferenceFiles(res.data?.reference_files || []);
  };

  useEffect(() => {
    let active = true;

    base44.functions.invoke('getDraftSettings', {})
      .then((res) => {
        if (!active || !res.data?.settings) return;
        const remote = res.data.settings;
        setSettings((prev) => ({
          ...prev,
          enableDrafts: remote.enable_drafts,
          unusedDraftsDays: remote.unused_drafts_days,
          responseStyle: remote.response_style,
          enableFollowUps: remote.enable_followups,
          followUpDays: remote.followup_days,
          customTone: remote.custom_tone_enabled,
          customToneText: remote.custom_tone_text || '',
          fontFamily: remote.font_family,
          fontSize: remote.font_size,
          fontColor: remote.font_color,
          includeSignature: remote.include_signature,
          defaultSignature: remote.default_signature || '',
        }));
      })
      .then(async () => {
        if (active) {
          await loadDraftAssets();
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await base44.functions.invoke('saveDraftSettings', {
        enable_drafts: settings.enableDrafts,
        unused_drafts_days: settings.unusedDraftsDays,
        response_style: settings.responseStyle,
        enable_followups: settings.enableFollowUps,
        followup_days: settings.followUpDays,
        custom_tone_enabled: settings.customTone,
        custom_tone_text: settings.customToneText,
        font_family: settings.fontFamily,
        font_size: settings.fontSize,
        font_color: settings.fontColor,
        include_signature: settings.includeSignature,
        default_signature: settings.defaultSignature,
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSignatures = async () => {
    setSavingSignatures(true);
    try {
      for (const account of accounts) {
        await base44.functions.invoke('saveAccountSignature', {
          email: account.email,
          signature_content: accountSignatures[account.email] || '',
        });
      }
      await loadDraftAssets();
    } finally {
      setSavingSignatures(false);
    }
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    setUploadingFiles(true);
    try {
      for (const file of files) {
        const uploadRes = await base44.integrations.Core.UploadFile({ file });
        await base44.functions.invoke('registerReferenceFile', {
          file_url: uploadRes.file_url,
          file_name: file.name,
          file_type: file.type,
          size_bytes: file.size,
        });
      }
      await loadDraftAssets();
      event.target.value = '';
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    await base44.functions.invoke('deleteReferenceFile', { file_id: fileId });
    await loadDraftAssets();
  };

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Bozze</h1>
        <button
          onClick={handleSave}
          disabled={loading || saving}
          className="text-sm text-gray-500 hover:text-gray-900 transition-colors font-medium disabled:opacity-50"
        >
          {loading ? 'Caricamento...' : saving ? 'Salvataggio...' : 'Aggiorna preferenze'}
        </button>
      </div>

      <div className="px-6 pt-5">
        <div className="flex gap-2 border-b border-gray-200 mb-6">
          {[
            { id: 'general', label: 'Generale' },
            { id: 'signatures', label: 'Firme' },
            { id: 'files', label: 'File personalizzati' },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.id ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'general' && (
          <div className="max-w-2xl space-y-5">
            {/* Draft settings */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Impostazioni Bozze</h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita risposte bozza</div>
                  <div className="text-xs text-brand">Genera automaticamente bozze di risposta per le email in arrivo</div>
                </div>
                <Toggle checked={settings.enableDrafts} onChange={v => setSettings(p => ({ ...p, enableDrafts: v }))} />
              </div>
              <div className="border-t border-gray-100 pt-4">
                <div className="text-xs text-gray-500 mb-2">Le bozze non utilizzate vengono eliminate dopo</div>
                <Counter value={settings.unusedDraftsDays} onChange={v => setSettings(p => ({ ...p, unusedDraftsDays: v }))} />
              </div>
            </div>

            {/* Response style */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Stile di risposta</h3>
              <div className="text-xs text-gray-500 mb-2">Con quale frequenza rispondi?</div>
              <select
                value={settings.responseStyle}
                onChange={e => setSettings(p => ({ ...p, responseStyle: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20"
              >
                <option value="everything">Rispondo a quasi tutto, anche solo per educazione</option>
                <option value="important">Rispondo solo alle email importanti</option>
                <option value="minimal">Rispondo solo quando strettamente necessario</option>
              </select>
            </div>

            {/* Follow-ups */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Follow-up</h3>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita bozze di follow-up</div>
                  <div className="text-xs text-brand">Crea automaticamente bozze di follow-up quando non hai ricevuto risposta</div>
                </div>
                <Toggle checked={settings.enableFollowUps} onChange={v => setSettings(p => ({ ...p, enableFollowUps: v }))} />
              </div>
              {settings.enableFollowUps && (
                <div className="border-t border-gray-100 pt-4">
                  <div className="text-xs text-gray-500 mb-2">Giorni prima del follow-up</div>
                  <Counter value={settings.followUpDays} onChange={v => setSettings(p => ({ ...p, followUpDays: v }))} max={14} />
                </div>
              )}
            </div>

            {/* Custom tone */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Tono personalizzato</h3>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">Abilita istruzioni personalizzate</div>
                  <div className="text-xs text-gray-500">Aggiungi istruzioni personalizzate per guidare la scrittura delle bozze</div>
                </div>
                <Toggle checked={settings.customTone} onChange={v => setSettings(p => ({ ...p, customTone: v }))} />
              </div>
              {settings.customTone && (
                <textarea
                  value={settings.customToneText}
                  onChange={e => setSettings(p => ({ ...p, customToneText: e.target.value }))}
                  placeholder="Es: Usa sempre il Lei formale. Chiudi con 'Cordiali saluti'. Non usare emoji."
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 resize-none h-24"
                />
              )}
            </div>

            {/* Font settings */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Impostazioni Font</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Famiglia font</label>
                  <div className="relative">
                    <select
                      value={settings.fontFamily}
                      onChange={e => setSettings(p => ({ ...p, fontFamily: e.target.value }))}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none appearance-none"
                    >
                      <option>Gmail/Outlook default</option>
                      <option>Arial</option>
                      <option>Georgia</option>
                      <option>Times New Roman</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Dimensione font</label>
                  <input
                    type="number"
                    value={settings.fontSize}
                    onChange={e => setSettings(p => ({ ...p, fontSize: parseInt(e.target.value) || 0 }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">Imposta 0 per ereditare la dimensione dal tuo client email.</p>
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Colore font</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={settings.fontColor}
                      onChange={e => setSettings(p => ({ ...p, fontColor: e.target.value }))}
                      className="w-8 h-8 rounded cursor-pointer border border-gray-200"
                    />
                    <input
                      type="text"
                      value={settings.fontColor}
                      onChange={e => setSettings(p => ({ ...p, fontColor: e.target.value }))}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Email threading */}
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Threading Email</h3>
              <p className="text-xs text-gray-500 mb-4">Per un funzionamento ottimale delle bozze, Gmail e Outlook devono raggruppare le email correlate in un thread.</p>
              <div className="space-y-2">
                <button
                  onClick={() => setSettings(p => ({ ...p, showThreadingGmail: !p.showThreadingGmail }))}
                  className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-gray-900 py-2 border-b border-gray-100"
                >
                  Come abilitare il threading in Gmail
                  <span>{settings.showThreadingGmail ? '▲' : '▼'}</span>
                </button>
                {settings.showThreadingGmail && (
                  <p className="text-xs text-gray-500 py-2">Vai su Gmail → Impostazioni → Visualizzazione conversazione → Abilita</p>
                )}
                <button
                  onClick={() => setSettings(p => ({ ...p, showThreadingOutlook: !p.showThreadingOutlook }))}
                  className="w-full flex items-center justify-between text-sm text-gray-700 hover:text-gray-900 py-2"
                >
                  Come abilitare il threading in Outlook
                  <span>{settings.showThreadingOutlook ? '▲' : '▼'}</span>
                </button>
                {settings.showThreadingOutlook && (
                  <p className="text-xs text-gray-500 py-2">Vai su Outlook → Visualizza → Mostra come conversazioni → Abilita</p>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'signatures' && (
          <div className="max-w-2xl space-y-5">
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Impostazioni Organizzazione</h3>
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-gray-900">Includi firme email nelle bozze</div>
                  <div className="text-xs text-gray-500">Disabilita se la tua organizzazione aggiunge firme automaticamente</div>
                </div>
                <Toggle checked={settings.includeSignature} onChange={v => setSettings(p => ({ ...p, includeSignature: v }))} />
              </div>
              <p className="text-xs text-gray-400">Useremo prima la tua firma specifica per account. Se non ne hai una, useremo la firma predefinita.</p>
            </div>
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">Firma predefinita</h3>
              <textarea
                value={settings.defaultSignature}
                onChange={e => setSettings(p => ({ ...p, defaultSignature: e.target.value }))}
                placeholder="Incolla qui la tua firma"
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none h-28 resize-none"
              />
            </div>
            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-900">Firme specifiche per account</h3>
                <button onClick={handleSaveSignatures} disabled={savingSignatures} className="text-sm text-gray-500 hover:text-gray-900 disabled:opacity-50">
                  {savingSignatures ? 'Salvataggio...' : 'Salva firme account'}
                </button>
              </div>
              <div className="space-y-4">
                {accounts.length === 0 ? (
                  <div className="text-xs text-gray-400">Connetti prima un account email per salvare firme specifiche.</div>
                ) : (
                  accounts.map((account) => (
                    <div key={account.email}>
                      <div className="text-xs text-brand mb-2">{account.email}</div>
                      <textarea
                        value={accountSignatures[account.email] || ''}
                        onChange={(e) => setAccountSignatures((prev) => ({ ...prev, [account.email]: e.target.value }))}
                        placeholder="Incolla la firma qui"
                        className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 bg-white focus:outline-none h-28 resize-none"
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'files' && (
          <div className="max-w-2xl space-y-5 relative">
            {showUploadModal && (
              <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-6" onClick={() => setShowUploadModal(false)}>
                <div className="bg-white rounded-2xl p-6 max-w-sm w-full" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-gray-900">Carica File via Email</h3>
                    <button onClick={() => setShowUploadModal(false)} className="text-gray-400 hover:text-gray-600">✕</button>
                  </div>
                  <p className="text-sm text-gray-600 mb-4">
                    Invia PDF, CSV o file Excel come allegati a{' '}
                    <span className="font-semibold text-brand">ai@mailmind.ai</span>{' '}
                    e scrivi semplicemente <em>upload</em> nel corpo. Li aggiungeremo automaticamente.
                  </p>
                  <button
                    onClick={() => setShowUploadModal(false)}
                    className="w-full bg-brand text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-brand/90 transition-colors"
                  >
                    Capito
                  </button>
                </div>
              </div>
            )}

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Carica File</h3>
              <p className="text-xs text-gray-500 mb-4">Carica documenti che MailMind AI può usare come riferimento nelle bozze. Questo aiuta a creare risposte più accurate e personalizzate.</p>
              <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors block">
                <div className="text-gray-400 text-2xl mb-2">📄</div>
                <div className="text-sm font-medium text-gray-700">Trascina i file qui</div>
                <div className="text-xs text-gray-400">oppure clicca per sfogliare • PDF, CSV • Max 10MB ciascuno</div>
                <div className="mt-2 text-sm text-brand font-medium hover:underline">{uploadingFiles ? 'Caricamento...' : 'Scegli file'}</div>
                <input type="file" multiple className="hidden" onChange={handleFileUpload} />
              </label>
            </div>

            <div className="bg-cream rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">I tuoi file</h3>
              {referenceFiles.length === 0 ? (
                <div className="bg-white border border-gray-100 rounded-xl p-8 text-center">
                  <div className="text-gray-300 text-3xl mb-2">📄</div>
                  <div className="text-sm text-gray-500">Nessun file caricato</div>
                  <div className="text-xs text-gray-400 mt-1">Carica documenti per aiutare MailMind AI a scrivere risposte migliori</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {referenceFiles.map((file) => (
                    <div key={file.id} className="bg-white border border-gray-100 rounded-xl p-4 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{file.file_name}</div>
                        <div className="text-xs text-gray-400">{file.file_type || 'file'} · {Math.round((file.size_bytes || 0) / 1024)} KB</div>
                      </div>
                      <button onClick={() => handleDeleteFile(file.id)} className="text-xs text-red-500 hover:text-red-600">Elimina</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}