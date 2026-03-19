import { useEffect, useRef, useState } from 'react';
import { api } from '@/api/privateApiClient';

export default function OAuthCallback() {
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Connessione in corso...');
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current) {
      return;
    }
    handledRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const state = params.get('state');
    const error = params.get('error');
    const callbackKey = `oauth-callback:${window.location.pathname}:${state || 'no-state'}:${code || 'no-code'}`;

    if (window.sessionStorage.getItem(callbackKey) === 'done') {
      setStatus('success');
      setMessage('Connessione gia completata. Chiudi questa finestra.');
      return;
    }

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
    const provider = path.includes('microsoft-calendar')
      ? 'microsoft-calendar'
      : path.includes('microsoft')
        ? 'microsoft'
        : path.includes('google-calendar')
          ? 'google-calendar'
          : path.includes('zoom')
            ? 'zoom'
            : 'google';
    const pendingState = window.opener?.sessionStorage?.getItem(`oauth-pending:${provider}`) || '';

    if (pendingState && state && pendingState !== state) {
      setStatus('error');
      setMessage('OAuth state non coerente con l’ultima richiesta. Chiudi la finestra e riprova dalla schermata principale.');
      window.opener?.postMessage({ type: 'oauth_error', error: 'OAuth state mismatch' }, '*');
      return;
    }

    api.post(`/integrations/oauth/${provider}/callback`, { code, state })
      .then(res => {
        window.sessionStorage.setItem(callbackKey, 'done');
        window.opener?.sessionStorage?.removeItem(`oauth-pending:${provider}`);
        setStatus('success');
        setMessage(`Account ${res.email} connesso con successo!`);
        window.opener?.postMessage({ type: 'oauth_success', provider, email: res.email }, '*');
        setTimeout(() => window.close(), 2000);
      })
      .catch(err => {
        if (err.message?.includes('Invalid or expired OAuth state')) {
          window.opener?.sessionStorage?.removeItem(`oauth-pending:${provider}`);
        }
        setStatus('error');
        setMessage(`Errore: ${err.message}`);
        window.opener?.postMessage({ type: 'oauth_error', error: err.message }, '*');
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
