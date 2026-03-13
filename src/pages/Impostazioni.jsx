import { useState } from 'react';
import { Link, useLocation, Outlet, Navigate } from 'react-router-dom';

const subNav = [
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
    <div className="h-full overflow-auto bg-gray-50">
      <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">
          {subNav.find(n => location.pathname === n.path)?.label || 'Impostazioni'}
        </h1>
        <button className="text-sm text-brand font-medium hover:underline">Aggiorna preferenze</button>
      </div>
      <div className="flex">
        <div className="w-40 px-4 py-4 border-r border-gray-100 bg-white min-h-screen">
          {subNav.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`block px-2 py-1.5 text-sm rounded transition-colors ${location.pathname === item.path ? 'text-gray-900 font-medium' : 'text-brand hover:text-brand/80'}`}
            >
              {item.label}
            </Link>
          ))}
        </div>
        <div className="flex-1">
          <Outlet />
        </div>
      </div>
    </div>
  );
}