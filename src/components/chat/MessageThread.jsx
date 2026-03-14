import ChatBubble from './ChatBubble';

export default function MessageThread({ messages, suggestions, onSuggestionClick }) {
  if (messages.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-4xl font-black text-brand mb-6">MailMind AI</h1>
        <div className="space-y-2 w-full max-w-xl">
          {suggestions.map((suggestion) => (
            <button key={suggestion} onClick={() => onSuggestionClick(suggestion)} className="block w-full bg-white border border-gray-100 rounded-lg px-4 py-3 text-sm text-left text-gray-500 hover:border-brand hover:text-brand transition-colors">
              {suggestion}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
      {messages.map((message) => <ChatBubble key={message.id} message={message} />)}
    </div>
  );
}