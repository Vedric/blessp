import { useLayoutEffect, useRef, type RefObject } from 'react';
import { useScrollLock } from './useScrollLock';

const activeDialogs: HTMLElement[] = [];

export function useDialogFocus(open: boolean, ref: RefObject<HTMLElement | null>, close: () => void): void {
  const closeRef = useRef(close);
  closeRef.current = close;
  useScrollLock(open);
  useLayoutEffect(() => {
    if (!open) return;
    const panel = ref.current;
    if (!panel) return;
    const previous = document.activeElement as HTMLElement | null;
    activeDialogs.push(panel);
    const isTop = () => activeDialogs.at(-1) === panel;
    const focusable = () => [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]')]
      .filter(node => node.tabIndex >= 0 && !node.closest('[inert]') && node.getClientRects().length > 0);
    const focusFirst = () => (panel.querySelector<HTMLElement>('[data-dialog-initial-focus]') ?? focusable()[0] ?? panel).focus({ preventScroll: true });
    const handle = (event: KeyboardEvent) => {
      if (!isTop()) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeRef.current(); return; }
      if (event.key !== 'Tab') return;
      const elements = focusable(); const first = elements[0]; const last = elements.at(-1);
      if (!first) { event.preventDefault(); panel.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || !panel.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    const containFocus = (event: FocusEvent) => {
      if (isTop() && !panel.contains(event.target as Node)) focusFirst();
    };
    document.addEventListener('keydown', handle);
    document.addEventListener('focusin', containFocus);
    // Focus must enter before the dialog is painted. A deferred timer can lose
    // the first keyboard action while focus still belongs to the opener.
    focusFirst();
    return () => {
      const wasTop = isTop();
      activeDialogs.splice(activeDialogs.indexOf(panel), 1);
      document.removeEventListener('keydown', handle);
      document.removeEventListener('focusin', containFocus);
      // React restores selection during the commit. Return focus afterwards so
      // it cannot be moved back into an overlay that is animating out.
      if (wasTop && previous && !panel.contains(previous)) queueMicrotask(() => {
        const current = activeDialogs.at(-1);
        if (previous.isConnected && (!current || current.contains(previous))) previous.focus({ preventScroll: true });
      });
    };
  }, [open, ref]);
}
