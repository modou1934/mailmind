import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';

// Page imports
import Home from './pages/Home';
import Onboarding from './pages/Onboarding';
import AppLayout from './components/AppLayout';
import Dashboard from './pages/Dashboard';
import Categorizzazione from './pages/Categorizzazione';
import Bozze from './pages/Bozze';
import Notetaker from './pages/Notetaker';
import Pianificazione from './pages/Pianificazione';
import Chat from './pages/Chat';
import Impostazioni from './pages/Impostazioni';
import Organizzazione from './pages/settings/Organizzazione';
import Persone from './pages/settings/Persone';
import Fatturazione from './pages/settings/Fatturazione';
import Integrazioni from './pages/settings/Integrazioni';
import OAuthCallback from './pages/OAuthCallback';

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/Home" replace />} />
      <Route path="/Home" element={<Home />} />
      <Route path="/onboarding" element={<Onboarding />} />
      
      {/* App routes with layout */}
      <Route element={<AppLayout />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/categorizzazione" element={<Categorizzazione />} />
        <Route path="/bozze" element={<Bozze />} />
        <Route path="/notetaker" element={<Notetaker />} />
        <Route path="/pianificazione" element={<Pianificazione />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/impostazioni" element={<Impostazioni />}>
          <Route path="organizzazione" element={<Organizzazione />} />
          <Route path="persone" element={<Persone />} />
          <Route path="fatturazione" element={<Fatturazione />} />
          <Route path="integrazioni" element={<Integrazioni />} />
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App