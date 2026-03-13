import { useState } from 'react';
import { Search, Plus, Send, Mic, ChevronDown, X } from 'lucide-react';

export default function Chat() {
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);

  return (
    <div className="h-full flex bg-gray-50">
      {/* Sidebar */}
      <div className="w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 outline-none" placeholder="Cerca" />
          </div>
          <button className="w-full flex items-center justify-center gap-2 bg-brand text-white py-2 rounded-lg text-sm font-medium hover:bg-brand/90">
            <Plus className="w-4 h-4" /> Nuova Chat
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-gray-400">Nessuna cronologia chat</p>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black text-brand mb-6">MailMind AI</h1>
          <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 w-96 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-1.5 border border-gray-200 rounded-full px-2 py-0.5">
                  <span className="text-base">✉️</span>
                  <span className="text-xs text-gray-600">utente@gmail.com</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </div>
              </div>
              <button className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                <Send className="w-3 h-3 text-gray-400" />
              </button>
            </div>
            <input
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Chiedimi qualcosa sulle tue riunioni & email..."
              className="w-full text-sm text-gray-600 outline-none placeholder-gray-400"
            />
          </div>
          <div className="mt-4 space-y-2">
            {['Come stava andando il progetto X?', 'Riassumi le email di questa settimana', 'Chi aspetta ancora mia risposta?'].map(q => (
              <button key={q} onClick={() => setMessage(q)} className="block w-96 mx-auto bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-400 text-left hover:border-brand hover:text-brand transition-colors">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}