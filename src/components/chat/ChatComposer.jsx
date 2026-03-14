import { Send } from 'lucide-react';

export default function ChatComposer({ value, onChange, onSend, isSending }) {
  return (
    <div className="border-t border-gray-100 bg-white p-4">
      <div className="max-w-3xl mx-auto flex items-center gap-3 border border-gray-200 rounded-2xl px-4 py-3 bg-white shadow-sm">
        <input value={value} onChange={(e) => onChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSend())} placeholder="Chiedimi qualcosa sulle tue email, bozze, riunioni o pianificazione..." className="flex-1 text-sm text-gray-700 outline-none placeholder-gray-400" />
        <button onClick={onSend} disabled={isSending || !value.trim()} className="w-8 h-8 bg-gray-900 rounded-full flex items-center justify-center disabled:opacity-50">
          <Send className="w-4 h-4 text-white" />
        </button>
      </div>
    </div>
  );
}