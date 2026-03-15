import { useEffect, useState } from "react";
import { Search, Plus, Send, Mic, ChevronDown } from "lucide-react";
import { api } from "@/api/privateApiClient";

export default function Chat() {
  const [message, setMessage] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeConv, setActiveConv] = useState(null);
  const [messages, setMessages] = useState([]);

  const loadConversations = async () => {
    try {
      const payload = await api.get("/chat/conversations");
      const items = payload.conversations || [];
      setConversations(items);
      if (!activeConv && items[0]) {
        setActiveConv(items[0]);
      }
    } catch (error) {
      console.error("Failed to load conversations", error);
    }
  };

  const loadMessages = async (conversationId) => {
    try {
      const payload = await api.get(`/chat/conversations/${conversationId}/messages`);
      setMessages(payload.messages || []);
    } catch (error) {
      console.error("Failed to load messages", error);
    }
  };

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    if (activeConv?.id) {
      loadMessages(activeConv.id);
    } else {
      setMessages([]);
    }
  }, [activeConv?.id]);

  const createConversation = async () => {
    try {
      const payload = await api.post("/chat/conversations", { title: "Nuova chat privata" });
      const conversation = payload.conversation;
      setConversations((current) => [conversation, ...current]);
      setActiveConv(conversation);
    } catch (error) {
      console.error("Failed to create conversation", error);
    }
  };

  const sendMessage = async () => {
    if (!message.trim()) {
      return;
    }

    let conversation = activeConv;
    if (!conversation) {
      const payload = await api.post("/chat/conversations", { title: "Nuova chat privata" });
      conversation = payload.conversation;
      setConversations((current) => [conversation, ...current]);
      setActiveConv(conversation);
    }

    try {
      const payload = await api.post(`/chat/conversations/${conversation.id}/messages`, {
        content: message.trim(),
      });
      setMessages((current) => [...current, payload.userMessage, payload.assistantMessage]);
      setMessage("");
      await loadConversations();
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  return (
    <div className="h-full flex bg-gray-50">
      <div className="w-56 bg-white border-r border-gray-100 flex flex-col flex-shrink-0">
        <div className="p-3">
          <div className="relative mb-3">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" />
            <input className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 outline-none" placeholder="Cerca" />
          </div>
          <button onClick={createConversation} className="w-full flex items-center justify-center gap-2 bg-brand text-white py-2 rounded-lg text-sm font-medium hover:bg-brand/90">
            <Plus className="w-4 h-4" /> Nuova Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {conversations.length ? conversations.map((conversation) => (
            <button
              key={conversation.id}
              onClick={() => setActiveConv(conversation)}
              className={`w-full text-left px-3 py-2 rounded-lg text-sm ${activeConv?.id === conversation.id ? "bg-gray-100 text-gray-900" : "text-gray-500 hover:bg-gray-50"}`}
            >
              {conversation.title}
            </button>
          )) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs text-gray-400">Nessuna cronologia chat</p>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto px-10 py-8">
          {!messages.length ? (
            <div className="text-center mb-8">
              <h1 className="text-5xl font-black text-brand mb-6">MailMind AI</h1>
              <div className="mt-4 space-y-2">
                {["Come stava andando il progetto X?", "Riassumi le email di questa settimana", "Chi aspetta ancora mia risposta?"].map((question) => (
                  <button key={question} onClick={() => setMessage(question)} className="block w-96 mx-auto bg-white border border-gray-100 rounded-lg px-4 py-2.5 text-sm text-gray-400 text-left hover:border-brand hover:text-brand transition-colors">
                    {question}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((entry) => (
                <div key={entry.id} className={`rounded-2xl px-4 py-3 ${entry.role === "assistant" ? "bg-white border border-gray-100 text-gray-700" : "bg-brand text-white ml-auto max-w-2xl"}`}>
                  {entry.content}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 bg-white px-8 py-4">
          <div className="bg-white border border-gray-200 rounded-2xl px-4 py-3 max-w-3xl mx-auto shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Mic className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-1.5 border border-gray-200 rounded-full px-2 py-0.5">
                  <span className="text-base">✉️</span>
                  <span className="text-xs text-gray-600">workspace privato</span>
                  <ChevronDown className="w-3 h-3 text-gray-400" />
                </div>
              </div>
              <button onClick={sendMessage} className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
                <Send className="w-3 h-3 text-gray-400" />
              </button>
            </div>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  sendMessage();
                }
              }}
              placeholder="Chiedimi qualcosa sulle tue riunioni e email private..."
              className="w-full text-sm text-gray-600 outline-none placeholder-gray-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
