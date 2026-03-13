import { useState, useRef, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Mic, ArrowUp, Plus, Search } from 'lucide-react';

export default function Chat() {
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const bottomRef = useRef(null);

  const suggestions = [
    "Cerca nelle mie email con Marco Ferrari",
    "Riassumi le ultime email da clienti questa settimana",
    "Quali email richiedono una risposta urgente?",
    "Trova tutte le email con fatture del mese scorso",
  ];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const createConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: 'mailmind_chat',
      metadata: { name: 'Nuova chat' }
    });
    setActiveConv(conv);
    setMessages([]);
    setConversations(prev => [conv, ...prev]);
  };

  const sendMessage = async (text) => {
    if (!text.trim() || loading) return;
    let conv = activeConv;
    if (!conv) {
      conv = { id: `temp_${Date.now()}`, messages: [] };
      setActiveConv(conv);
    }
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Sei MailMind AI, un assistente email intelligente per professionisti italiani. 
L'utente chiede: ${text}
Rispondi in italiano in modo conciso e utile, come se potessi accedere alle sue email (usa dati di esempio realistici).`,
      });
      setMessages(prev => [...prev, { role: 'assistant', content: result }]);
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Mi dispiace, si è verificato un errore. Riprova.' }]);
    }
    setLoading(false);
  };

  return (
    <div className="h-full flex overflow-hidden">
      {/* Chat list sidebar */}
      <div className="w-56 border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
        <div className="p-3 border-b border-gray-100">
          <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
            <Search className="w-3.5 h-3.5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cerca"
              className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
            />
          </div>
        </div>
        <div className="p-2">
          <button
            onClick={createConversation}
            className="w-full flex items-center gap-2 bg-brand text-white px-3 py-2 rounded-xl text-sm font-semibold hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Nuova Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Nessuna chat</p>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => { setActiveConv(conv); setMessages(conv.messages || []); }}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors truncate ${activeConv?.id === conv.id ? 'bg-gray-100 font-medium' : 'text-gray-600'}`}
              >
                {conv.metadata?.name || 'Chat'}
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {messages.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center px-6">
            <h1 className="text-4xl font-black text-brand mb-8">MailMind AI</h1>
            <div className="w-full max-w-lg">
              <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                  placeholder="Chiedi qualcosa sulle tue riunioni e email..."
                  className="w-full px-4 py-3.5 text-sm text-gray-700 outline-none placeholder-gray-400"
                />
                <div className="flex items-center gap-2 px-3 pb-2.5 border-t border-gray-100 pt-2">
                  <div className="flex items-center gap-1.5 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs text-gray-600">
                    <span className="text-base">M</span>
                    <span>utente@gmail.com</span>
                    <span className="text-gray-300">▾</span>
                  </div>
                  <button className="p-1.5 hover:bg-gray-100 rounded-lg">
                    <Mic className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button
                    onClick={() => sendMessage(input)}
                    className="ml-auto p-1.5 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl px-4 py-2.5 text-sm text-gray-600 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center mr-2 flex-shrink-0 mt-0.5">
                      <span className="text-brand font-black text-xs">M</span>
                    </div>
                  )}
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === 'user'
                      ? 'bg-gray-900 text-white'
                      : 'bg-white border border-gray-200 text-gray-800'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="w-7 h-7 rounded-lg bg-brand/10 flex items-center justify-center mr-2 flex-shrink-0">
                    <span className="text-brand font-black text-xs">M</span>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-2xl px-4 py-2.5">
                    <div className="flex gap-1.5 items-center">
                      {[0,1,2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t border-gray-200 px-6 py-3">
              <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl overflow-hidden">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
                  placeholder="Chiedi qualcosa..."
                  className="flex-1 px-4 py-2.5 text-sm outline-none placeholder-gray-400"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim() || loading}
                  className="mr-2 p-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}