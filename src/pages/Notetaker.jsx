import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import UploadMeetingNoteCard from '@/components/notetaker/UploadMeetingNoteCard';
import MeetingNoteCard from '@/components/notetaker/MeetingNoteCard';

export default function Notetaker() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState([]);

  const loadNotes = async (currentUser) => {
    const items = await base44.entities.MeetingNote.filter({ user_id: currentUser.id });
    const sorted = [...items].sort((a, b) => new Date(b.updated_date || b.created_date) - new Date(a.updated_date || a.created_date));
    setNotes(sorted);
  };

  useEffect(() => {
    let active = true;
    base44.auth.me().then(async (currentUser) => {
      if (!active) return;
      setUser(currentUser);
      await loadNotes(currentUser);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const uploadRes = await base44.integrations.Core.UploadFile({ file });
      await base44.functions.invoke('createMeetingNoteFromUpload', {
        file_url: uploadRes.file_url,
        title: title || file.name,
      });
      setTitle('');
      event.target.value = '';
      await loadNotes(user);
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <div className="h-full flex items-center justify-center text-sm text-gray-400">Caricamento note riunione...</div>;
  }

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Notetaker</h1>
      </div>

      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <UploadMeetingNoteCard
          title={title}
          onTitleChange={setTitle}
          onFileChange={handleFileUpload}
          isUploading={uploading}
        />

        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Le tue note riunione</h2>
            <p className="text-xs text-gray-500">Trascrizioni, riassunti e action items delle registrazioni caricate.</p>
          </div>

          {notes.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 p-8 text-center">
              <div className="text-gray-300 text-3xl mb-2">📝</div>
              <div className="text-sm text-gray-500">Nessuna nota riunione ancora</div>
              <div className="text-xs text-gray-400 mt-1">Carica un file per iniziare</div>
            </div>
          ) : (
            notes.map((note) => <MeetingNoteCard key={note.id} note={note} />)
          )}
        </div>
      </div>
    </div>
  );
}