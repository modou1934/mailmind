import { useEffect, useMemo, useState } from 'react';
import { base44 } from '@/api/base44Client';
import ConversationList from '@/components/chat/ConversationList';
import MessageThread from '@/components/chat/MessageThread';
import ChatComposer from '@/components/chat/ChatComposer';

const suggestions = [
  'Riassumi le email importanti di questa settimana',
  'Quali bozze ho già pronte da inviare?',
  'Quali riunioni recenti hanno action item aperti?',
];

export default function Chat() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);

  const loadConversations = async (currentUser) => {
    const items = await base44.entities.ChatConversation.filter({ user_id: currentUser.id });
    const sorted = [...items].sort((a, b) => new Date(b.last_message_at || b.updated_date || 0) - new Date(a.last_message_at || a.updated_date || 0));
    setConversations(sorted);
    if (!activeConversation && sorted.length > 0) {
      setActiveConversation(sorted[0]);
    }
    return sorted;
  };

  const loadMessages = async (conversationId, currentUser) => {
    if (!conversationId || !currentUser) {
      setMessages([]);
      return;
    }
    const items = await base44.entities.ChatMessage.filter({ conversation_id: conversationId, user_id: currentUser.id });
    const sorted = [...items].sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
    setMessages(sorted);
  };

  useEffect(() => {
    let active = true;
    base44.auth.me().then(async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      await loadConversations(currentUser);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user && activeConversation?.id) {
      loadMessages(activeConversation.id, user);
    } else {
      setMessages([]);
    }
  }, [user, activeConversation]);

  const filteredConversations = useMemo(() => conversations.filter((conversation) => (conversation.title || '').toLowerCase().includes(search.toLowerCase())), [conversations, search]);

  const handleNewChat = async () => {
    if (!user) return;
    const conversation = await base44.entities.ChatConversation.create({
      user_id: user.id,
      title: 'Nuova chat',
      context_type: 'workspace',
      last_message_at: new Date().toISOString(),
    });
    const updated = [conversation, ...conversations];
    setConversations(updated);
    setActiveConversation(conversation);
    setMessages([]);
    setMessage('');
  };

  const handleSend = async (presetMessage) => {
    const nextMessage = (presetMessage ?? message).trim();
    if (!nextMessage || !user) return;

    setSending(true);
    try {
      let conversation = activeConversation;
      if (!conversation) {
        conversation = await base44.entities.ChatConversation.create({
          user_id: user.id,
          title: nextMessage.slice(0, 60),
          context_type: 'workspace',
          last_message_at: new Date().toISOString(),
        });
        setActiveConversation(conversation);
      }

      setMessage('');
      await base44.functions.invoke('workspaceChat', {
        conversation_id: conversation.id,
        message: nextMessage,
      });

      const updatedConversations = await loadConversations(user);
      const refreshed = updatedConversations.find((item) => item.id === conversation.id) || conversation;
      setActiveConversation(refreshed);
      await loadMessages(conversation.id, user);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-400">Caricamento chat...</div>;
  }

  return (
    <div className="h-full flex bg-gray-50">
      <ConversationList
        conversations={filteredConversations}
        activeId={activeConversation?.id}
        search={search}
        onSearchChange={setSearch}
        onSelect={setActiveConversation}
        onNewChat={handleNewChat}
      />
      <div className="flex-1 flex flex-col">
        <MessageThread messages={messages} suggestions={suggestions} onSuggestionClick={handleSend} />
        <ChatComposer value={message} onChange={setMessage} onSend={() => handleSend()} isSending={sending} />
      </div>
    </div>
  );
}