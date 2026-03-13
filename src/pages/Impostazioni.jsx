import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';

const settingsNav = [
  { path: '/impostazioni/organizzazione', label: 'Organizzazione' },
  { path: '/impostazioni/persone', label: 'Persone' },
  { path: '/impostazioni/fatturazione', label: 'Fatturazione' },
  { path: '/impostazioni/integrazioni', label: 'Integrazioni' },
];

export default function Impostazioni() {
  const location = useLocation();

  if (location.pathname === '/impostazioni') {
    return <Navigate to="/impostazioni/organizzazione" replace />;
  }

  return (
    <div className="h-full overflow-auto">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 bg-white sticky top-0 z-10">
        <h1 className="text-base font-semibold text-gray-900">Impostazioni</h1>
        <button className="text-sm text-gray-500 hover:text-gray-900 font-medium transition-colors">
          Aggiorna preferenze
        </button>
      </div>
      <div className="flex">
        <aside className="w-40 border-r border-gray-100 py-4 flex-shrink-0">
          <nav className="space-y-0.5 px-2">
            {settingsNav.map(item => (
              <Link
                key={item.path}
                to={item.path}
                className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                  location.pathname === item.path
                    ? 'bg-gray-100 font-semibold text-gray-900'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <div className="flex-1 overflow-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}