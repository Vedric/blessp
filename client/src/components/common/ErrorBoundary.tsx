import { Component, type ErrorInfo, type ReactNode } from 'react';
import i18n from '@/i18n';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('Unhandled React error', {
      message: error.message,
      stack: error.stack,
      componentStack: info.componentStack,
    });
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleHome = (): void => {
    window.location.href = '/';
  };

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const t = i18n.t.bind(i18n);
    return (
      <div
        role="alert"
        className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center"
      >
        <div className="max-w-md">
          <h1 className="font-display text-3xl font-light tracking-tight text-neutral-900">
            {t('error.boundary.title')}
          </h1>
          <div className="mx-auto mt-2 h-px w-12 bg-brand-500" />
          <p className="mt-6 text-base leading-relaxed text-neutral-600">
            {t('error.boundary.message')}
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={this.handleReload}
              className="bg-neutral-900 px-8 py-3 text-xs font-medium tracking-widest text-white uppercase transition-colors hover:bg-neutral-800"
            >
              {t('error.boundary.reload')}
            </button>
            <button
              onClick={this.handleHome}
              className="border border-neutral-200 px-8 py-3 text-xs font-medium tracking-widest text-neutral-700 uppercase transition-colors hover:bg-neutral-50"
            >
              {t('error.boundary.home')}
            </button>
          </div>
        </div>
      </div>
    );
  }
}
