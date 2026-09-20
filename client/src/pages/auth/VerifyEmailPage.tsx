import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

export default function VerifyEmailPage() {
  const { i18n } = useTranslation();
  const fr = i18n.resolvedLanguage === 'fr';
  const { hash } = useLocation();
  const navigate = useNavigate();
  const token = new URLSearchParams(hash.slice(1)).get('token');
  const activeToken = useRef(token);
  activeToken.current = token;
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  useEffect(() => {
    if (token) { setVerified(false); setMessage(''); setBusy(false); }
  }, [token]);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setMessage('');
    try {
      await api.post(token ? '/auth/verify-email' : '/auth/resend-verification', token ? { token } : { email });
      if (activeToken.current !== token) return;
      setVerified(!!token);
      if (token) void navigate('/verify-email', { replace: true });
      setMessage(token ? (fr ? 'Adresse vérifiée. Vous pouvez vous connecter.' : 'Email verified. You can sign in.') : (fr ? 'Consultez votre boîte e-mail pour la suite.' : 'Check your inbox for the next steps.'));
    } catch (error) { if (activeToken.current === token) setMessage((error as { message?: string }).message ?? (fr ? 'Une erreur est survenue.' : 'Something went wrong.')); }
    finally { if (activeToken.current === token) setBusy(false); }
  };
  return <div className="mx-auto max-w-md px-6 py-32">
    <h1 className="text-2xl">{fr ? 'Vérifiez votre adresse e-mail' : 'Verify your email address'}</h1>
    <p className="my-6 text-neutral-700">{fr ? 'L’activation du compte nécessite le lien envoyé par e-mail. Vérifiez aussi vos courriers indésirables.' : 'Activate your account using the link sent by email. Check your spam folder too.'}</p>
    {!verified && <form onSubmit={submit} className="space-y-4">
      {!token && <label className="block">Email<input className="mt-2 w-full border p-3" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>}
      <button disabled={busy} className="bg-neutral-900 px-5 py-3 text-white disabled:opacity-50">{token ? (fr ? 'Confirmer mon adresse' : 'Confirm my email') : (fr ? 'Renvoyer le lien' : 'Resend link')}</button>
    </form>}
    {message && <p role="status" className="my-5">{message}</p>}
    <Link className="mt-5 inline-block underline" to="/signin">{fr ? 'Connexion' : 'Sign in'}</Link>
  </div>;
}
