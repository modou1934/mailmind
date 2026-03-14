import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';

function getNextSevenDays() {
  return Array.from({ length: 7 }).map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() + index);
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
}

export default function BookMeeting() {
  const { slug } = useParams();
  const [loading, setLoading] = useState(true);
  const [booking, setBooking] = useState(false);
  const [profile, setProfile] = useState(null);
  const [selectedDate, setSelectedDate] = useState(getNextSevenDays()[0]);
  const [slots, setSlots] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [success, setSuccess] = useState(false);

  const dates = useMemo(() => getNextSevenDays(), []);

  const loadProfile = async (dateToLoad = selectedDate) => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('getPublicSchedulingProfile', { slug, date: dateToLoad });
      setProfile(res.data.profile);
      setSlots(res.data.slots || []);
      if (!(res.data.slots || []).includes(selectedTime)) {
        setSelectedTime('');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (slug) {
      loadProfile(selectedDate);
    }
  }, [slug]);

  const handleDateChange = async (date) => {
    setSelectedDate(date);
    await loadProfile(date);
  };

  const handleBooking = async () => {
    if (!selectedTime || !guestName.trim() || !guestEmail.trim()) return;
    setBooking(true);
    try {
      await base44.functions.invoke('createMeetingBooking', {
        slug,
        guest_name: guestName,
        guest_email: guestEmail,
        scheduled_date: selectedDate,
        start_time: selectedTime,
        notes,
      });
      setSuccess(true);
    } finally {
      setBooking(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Caricamento disponibilità...</div>;
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-sm text-gray-400">Link di pianificazione non trovato.</div>;
  }

  if (success) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6"><div className="bg-white rounded-2xl border border-gray-100 p-8 text-center max-w-md w-full"><div className="text-3xl mb-3">✅</div><h1 className="text-xl font-bold text-gray-900 mb-2">Riunione confermata</h1><p className="text-sm text-gray-500">Ti abbiamo inviato una conferma per il {selectedDate} alle {selectedTime}.</p></div></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Prenota una riunione</h1>
          <p className="text-sm text-gray-500 mb-6">Durata {profile.meeting_duration_minutes} min · Timezone {profile.timezone}</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data</label>
              <div className="grid grid-cols-2 gap-2">
                {dates.map((date) => (
                  <button key={date} onClick={() => handleDateChange(date)} className={`border rounded-lg px-3 py-2 text-sm ${selectedDate === date ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-gray-700'}`}>{date}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Orario disponibile</label>
              <div className="grid grid-cols-3 gap-2">
                {slots.length === 0 ? <p className="text-sm text-gray-400 col-span-3">Nessuno slot disponibile per questa data.</p> : slots.map((slot) => (
                  <button key={slot} onClick={() => setSelectedTime(slot)} className={`border rounded-lg px-3 py-2 text-sm ${selectedTime === slot ? 'border-brand text-brand bg-brand/5' : 'border-gray-200 text-gray-700'}`}>{slot}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-4">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Il tuo nome</label>
            <input value={guestName} onChange={(e) => setGuestName(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">La tua email</label>
            <input value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Note opzionali</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm h-28 resize-none" />
          </div>
          <button onClick={handleBooking} disabled={booking || !selectedTime || !guestName.trim() || !guestEmail.trim()} className="w-full bg-gray-900 text-white py-3 rounded-xl font-semibold hover:bg-gray-800 disabled:opacity-50">{booking ? 'Conferma in corso...' : 'Conferma riunione'}</button>
        </div>
      </div>
    </div>
  );
}