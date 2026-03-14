export default function ChatBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-2xl rounded-2xl px-4 py-3 text-sm leading-relaxed ${isUser ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
        <p className="whitespace-pre-wrap">{message.content}</p>
      </div>
    </div>
  );
}