import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';

export default function OAuthCallback() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Connessione in corso...');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state'); // userId
    const error = params.get('error');

    if (error) {
      setStatus('error');
      setMessage('Autorizzazione negata. Chiudi questa finestra e riprova.');
      window.opener?.postMessage({ type: 'oauth_error', error }, '*');
      return;
    }

    if (!code || !state) {
      setStatus('error');
      setMessage('Parametri mancanti. Chiudi questa finestra e riprova.');
      return;
    }

    // Detect provider from URL path
    const path = window.location.pathname;
    const provider = path.includes('microsoft') ? 'microsoft' : 'google';
    const redirect_uri = `${window.location.origin}${window.location.pathname}`;

    base44.functions.invoke('oauthCallback', { code, provider, redirect_uri, state })
      .then(res => {
        setStatus('success');
        setMessage(`Account ${res.data.email} connesso con successo!`);
        window.opener?.postMessage({ type: 'oauth_success', provider, email: res.data.email }, '*');
        setTimeout(() => window.close(), 2000);
      })
      .catch(err => {
        const detail = err.response?.data?.error || err.message;
        setStatus('error');
        setMessage(`Errore: ${detail}`);
        window.opener?.postMessage({ type: 'oauth_error', error: detail }, '*');
      });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center p-8 max-w-sm">
        {status === 'processing' && (
          <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        )}
        {status === 'success' && (
          <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✓</div>
        )}
        {status === 'error' && (
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">✗</div>
        )}
        <p className="text-sm text-muted-foreground">{message}</p>
        {status !== 'processing' && (
          <button onClick={() => window.close()} className="mt-4 text-sm text-brand underline">
            Chiudi finestra
          </button>
        )}
      </div>
    </div>
  );
}