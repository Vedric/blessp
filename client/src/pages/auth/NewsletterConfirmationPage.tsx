import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

export default function NewsletterConfirmationPage() {
  const { i18n } = useTranslation(); const fr = i18n.resolvedLanguage === 'fr';
  const [params] = useState(() => new URLSearchParams(window.location.hash.slice(1)));
  const unsubscribe = params.has('unsubscribe');
  const token = params.get(unsubscribe ? 'unsubscribe' : 'token');
  const [message, setMessage] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async () => { setBusy(true); try { await api.post(`/newsletter/${unsubscribe ? 'unsubscribe' : 'confirm'}`, { token }); window.history.replaceState(null, '', '/newsletter/confirm'); setMessage(fr ? 'Votre choix a été enregistré.' : 'Your choice has been saved.'); } catch { setMessage(fr ? 'Lien invalide ou expiré.' : 'Invalid or expired link.'); } finally { setBusy(false); } };
  return <div className="mx-auto max-w-md px-6 py-32"><h1 className="mb-8 text-2xl">Newsletter</h1>{!message && token && <button disabled={busy} onClick={submit} className="bg-neutral-900 px-5 py-3 text-white">{unsubscribe ? (fr ? 'Confirmer le désabonnement' : 'Confirm unsubscribe') : (fr ? 'Confirmer l’abonnement' : 'Confirm subscription')}</button>}<p role="status">{message}</p></div>;
}
