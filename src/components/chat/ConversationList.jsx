export default function ConversationList({ conversations, activeId, search, onSearchChange, onSelect, onNewChat }) {
  return (
    <div className="w-64 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
      <div className="p-3 space-y-3">
        <input value={search} onChange={(e) => onSearchChange(e.target.value)} className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 outline-none" placeholder="Cerca chat" />
        <button onClick={onNewChat} className="w-full bg-brand text-white py-2 rounded-lg text-sm font-medium hover:bg-brand/90">Nuova Chat</button>
      </div>
      <div className="flex-1 overflow-auto px-2 pb-3 space-y-1">
        {conversations.length === 0 ? <p className="text-xs text-gray-400 px-2">Nessuna cronologia chat</p> : conversations.map((conversation) => (
          <button key={conversation.id} onClick={() => onSelect(conversation)} className={`w-full text-left rounded-lg px-3 py-2 ${activeId === conversation.id ? 'bg-brand/10 text-brand' : 'hover:bg-gray-50 text-gray-700'}`}>
            <div className="text-sm font-medium truncate">{conversation.title || 'Nuova chat'}</div>
            <div className="text-xs text-gray-400 truncate">{conversation.last_message_at ? new Date(conversation.last_message_at).toLocaleDateString('it-IT') : 'Adesso'}</div>
          </button>
        ))}
      </div>
    </div>
  );
}