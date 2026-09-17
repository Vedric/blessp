import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';
import { Breadcrumbs } from '@/components/common/Breadcrumbs';
import { Pagination } from '@/components/common/Pagination';

type Message = { id: string; name: string; email: string; subject: string; message: string; createdAt: string; readAt: string | null };
type Inbox = { items: Message[]; unread: number; pagination: { totalPages: number; totalItems: number } };
export default function AdminContactPage() {
  const { t, i18n } = useTranslation();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('unread');
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [data, setData] = useState<Inbox | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const saving = useRef(false);
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(false);
    const timer = setTimeout(() => {
      const query = new URLSearchParams({ search, status, page: String(page), perPage: '20' });
      api.get<Inbox>(`/admin/contact?${query}`, { signal: controller.signal })
        .then(result => { if (!controller.signal.aborted) { if (page > 1 && !result.items.length) setPage(Math.max(1, result.pagination.totalPages)); else setData(result); } })
        .catch(() => { if (!controller.signal.aborted) setError(true); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [search, status, page, attempt]);
  const mark = async (message: Message) => {
    if (saving.current) return;
    saving.current = true; setBusy(message.id); setSaveError(false); setNotice('');
    try {
      await api.patch(`/admin/contact/${message.id}`, { read: !message.readAt });
      setNotice(t('support.updated')); setAttempt(value => value + 1);
    } catch { setSaveError(true); }
    finally { saving.current = false; setBusy(null); }
  };
  const inputClass = 'mt-2 min-h-11 w-full border border-neutral-300 bg-white px-3 py-2 text-sm';
  return <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
    <Breadcrumbs items={[{ label: t('nav.admin'), href: '/admin' }, { label: t('support.title') }]} />
    <h1 className="mt-8 font-display text-3xl">{t('support.title')}</h1>
    <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-600">{t('support.description')}</p>
    <p className="mt-5 text-sm font-medium">{t('support.unreadCount', { count: data?.unread ?? 0 })}</p>
    <div className="mt-6 flex flex-wrap items-end gap-4">
      <label htmlFor="support-search" className="min-w-0 basis-full text-sm sm:flex-1 sm:basis-0">{t('support.search')}<input id="support-search" type="search" maxLength={100} value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} className={inputClass} /></label>
      <label htmlFor="support-status" className="flex-1 text-sm sm:flex-none">{t('support.status')}<select id="support-status" value={status} onChange={event => { setStatus(event.target.value); setPage(1); }} className={inputClass}>{['unread', 'read', 'all'].map(value => <option key={value} value={value}>{t(`support.states.${value}`)}</option>)}</select></label>
      <button onClick={() => setAttempt(value => value + 1)} className="min-h-11 border border-neutral-300 px-4 text-sm">{t('support.refresh')}</button>
    </div>
    {notice && <p role="status" className="mt-4 text-sm text-green-800">{notice}</p>}
    {(error || saveError) && <p role="alert" className="mt-4 text-sm text-red-800">{t(error ? 'support.loadError' : 'support.saveError')} {error && <button className="min-h-11 underline" onClick={() => setAttempt(value => value + 1)}>{t('common.retry')}</button>}</p>}
    <div aria-busy={loading} className="mt-6 space-y-4">
      {loading && <p role="status" className="text-sm text-neutral-600">{t('common.loading')}</p>}
      {!loading && !error && !data?.items.length && <p className="border p-6 text-sm">{t('support.empty')}</p>}
      {data?.items.map(message => <article key={message.id} className="min-w-0 border border-neutral-200 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><h2 className="min-w-0 break-words font-medium">{message.subject}</h2><span className="text-xs text-neutral-600">{t(`support.states.${message.readAt ? 'read' : 'unread'}`)}</span></div>
        <p className="mt-2 break-words text-sm text-neutral-600">{message.name} · {message.email}</p>
        <time dateTime={message.createdAt} className="mt-1 block text-xs text-neutral-600">{new Date(message.createdAt).toLocaleString(i18n.resolvedLanguage)}</time>
        <details className="mt-4"><summary className="min-h-11 cursor-pointer py-3 text-sm underline underline-offset-4">{t('support.open')}</summary><p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.message}</p></details>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <a href={`mailto:${encodeURIComponent(message.email)}?subject=${encodeURIComponent(`Re: ${message.subject}`)}`} className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">{t('support.reply')}</a>
          <button disabled={loading || busy !== null} onClick={() => void mark(message)} className="min-h-11 border border-neutral-900 px-4 text-sm disabled:opacity-50">{t(busy === message.id ? 'common.loading' : message.readAt ? 'support.markUnread' : 'support.markRead')}</button>
        </div>
      </article>)}
    </div>
    {data && <Pagination page={page} totalPages={data.pagination.totalPages} onChange={setPage} />}
  </div>;
}
