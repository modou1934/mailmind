export default function UploadMeetingNoteCard({ title, onTitleChange, onFileChange, isUploading }) {
  return (
    <div className="bg-cream rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-2">Carica audio o registrazione</h3>
      <p className="text-xs text-gray-500 mb-4">Carica un file audio o video della riunione per ottenere trascrizione, riassunto e action items.</p>
      <input value={title} onChange={(e) => onTitleChange(e.target.value)} placeholder="Titolo riunione" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white mb-4" />
      <label className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-gray-400 transition-colors block bg-white">
        <div className="text-gray-400 text-2xl mb-2">🎙️</div>
        <div className="text-sm font-medium text-gray-700">Seleziona file audio o video</div>
        <div className="text-xs text-gray-400">mp3, wav, m4a, mp4, mov</div>
        <div className="mt-2 text-sm text-brand font-medium">{isUploading ? 'Caricamento...' : 'Scegli file'}</div>
        <input type="file" accept="audio/*,video/*" className="hidden" onChange={onFileChange} />
      </label>
    </div>
  );
}