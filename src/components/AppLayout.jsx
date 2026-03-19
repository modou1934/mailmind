import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { 
  Home, Tag, FileText, Mic, Calendar, MessageSquare, Settings, Clock3,
  Bell, ChevronDown, X, ArrowUpRight
} from 'lucide-react';

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: Home },
  { path: '/awaiting-reply', label: 'Awaiting Reply', icon: Clock3 },
  { path: '/categorizzazione', label: 'Categorizzazione', icon: Tag },
  { path: '/bozze', label: 'Bozze', icon: FileText },
  { path: '/notetaker', label: 'Notetaker', icon: Mic },
  { path: '/pianificazione', label: 'Pianificazione', icon: Calendar },
  { path: '/chat', label: 'Chat', icon: MessageSquare },
  { path: '/impostazioni', label: 'Impostazioni', icon: Settings },
];

const notifications = [
  { id: 1, title: 'Email configurata', desc: 'MailMind AI ha completato la configurazione per il tuo account Gmail.', link: true, read: false },
  { id: 2, title: 'Invita un collega', desc: 'Ottieni 7 giorni extra di prova per ogni collega che inviti a MailMind AI.', link: true, read: false },
];

export default function AppLayout() {
  const location = useLocation();
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifTab, setNotifTab] = useState('unread');
  const [workspace, setWorkspace] = useState('personal');

  if (location.pathname === '/app') {
    return <Navigate to="/dashboard" replace />;
  }

  const unread = notifications.filter(n => !n.read);

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-inter">
      {/* Sidebar */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Logo + Bell */}
        <div className="px-4 py-3 flex items-center justify-between">
          <Link to="/dashboard" className="text-brand font-black text-xl tracking-tight">
            MailMind
          </Link>
          <button
            onClick={() => setShowNotifications(true)}
            className="relative p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <Bell className="w-4 h-4 text-gray-600" />
            {unread.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-white text-[10px] flex items-center justify-center font-bold">
                {unread.length}
              </span>
            )}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-2 space-y-0.5 overflow-y-auto">
          {navItems.map(({ path, label, icon: Icon }) => {
            const isActive = location.pathname === path ||
              (path === '/impostazioni' && location.pathname.startsWith('/impostazioni'));
            return (
              <Link
                key={path}
                to={path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  isActive
                    ? 'bg-gray-100 font-semibold text-gray-900'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-gray-900' : 'text-gray-400'}`} />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Workspace switcher */}
        <div className="p-2 border-t border-gray-100 space-y-1">
          <button
            onClick={() => setWorkspace('personal')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${workspace === 'personal' ? 'bg-gray-50' : ''}`}
          >
            <div className="w-6 h-6 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold flex-shrink-0">M</div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs font-semibold text-gray-800 truncate">Il mio Spazio</div>
              <div className="text-[11px] text-brand font-medium">PRO</div>
            </div>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
          <button
            onClick={() => setWorkspace('org')}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-gray-50 transition-colors ${workspace === 'org' ? 'bg-gray-50' : ''}`}
          >
            <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">U</div>
            <div className="flex-1 text-left min-w-0">
              <div className="text-xs font-semibold text-gray-800 truncate">utente@gmail.com</div>
            </div>
            <ChevronDown className="w-3 h-3 text-gray-400" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>

      {/* Notifications overlay */}
      {showNotifications && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
          <div className="fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-2xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
              <span className="font-semibold text-gray-900">Notifiche</span>
              <button onClick={() => setShowNotifications(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="flex border-b border-gray-100">
              <button
                onClick={() => setNotifTab('unread')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${notifTab === 'unread' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Non lette
              </button>
              <button
                onClick={() => setNotifTab('read')}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${notifTab === 'read' ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Lette
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="text-xs font-medium text-gray-500 px-2 py-2">Notifiche</div>
              {notifTab === 'unread' ? (
                notifications.map(n => (
                  <div key={n.id} className="flex items-start gap-2 p-3 rounded-lg hover:bg-gray-50 cursor-pointer border border-transparent hover:border-gray-100 mb-1">
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{n.title}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{n.desc}</div>
                    </div>
                    {n.link && <ArrowUpRight className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />}
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-500 text-center py-8">Nessuna notifica letta</div>
              )}
            </div>
            <div className="px-4 py-3 border-t border-gray-100">
              <button className="text-sm text-gray-500 hover:text-gray-700">Segna tutte come lette</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
