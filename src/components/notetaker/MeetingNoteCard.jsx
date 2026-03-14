export default function MeetingNoteCard({ note }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{note.title}</h3>
          <p className="text-xs text-gray-400">{note.duration_seconds ? `${Math.round(note.duration_seconds / 60)} min` : 'Durata non disponibile'} · {note.status}</p>
        </div>
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-500 mb-1">Riassunto</div>
        <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.summary || 'Nessun riassunto disponibile'}</p>
      </div>
      <div>
        <div className="text-xs font-semibold text-gray-500 mb-1">Action items</div>
        {note.action_items?.length ? (
          <ul className="list-disc ml-5 text-sm text-gray-700 space-y-1">
            {note.action_items.map((item, index) => <li key={index}>{item}</li>)}
          </ul>
        ) : (
          <p className="text-sm text-gray-400">Nessuna azione rilevata</p>
        )}
      </div>
      <details>
        <summary className="text-xs text-brand cursor-pointer">Vedi trascrizione</summary>
        <p className="text-sm text-gray-600 whitespace-pre-wrap mt-2">{note.transcript || 'Trascrizione non disponibile'}</p>
      </details>
    </div>
  );
}