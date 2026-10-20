// Toast notifications and clipboard copy with a fallback (spec §6.2, FR-59).
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '../components/Icon';
import { t } from '../i18n';

interface Toast {
  id: number;
  message: string;
  fallback?: string;
}

interface ToastApi {
  show(message: string, fallback?: string): void;
  copy(text: string): Promise<boolean>;
}

const ToastContext = createContext<ToastApi | null>(null);

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function FallbackField({ text }: { text: string }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  return <input ref={ref} readOnly value={text} aria-label={t('toast.commandToCopy')} onFocus={(e) => e.currentTarget.select()} />;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const seq = useRef(0);

  const show = useCallback((message: string, fallback?: string) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-2), { id, message, fallback }]);
    window.setTimeout(() => setToasts((list) => list.filter((toast) => toast.id !== id)), fallback ? 8000 : 2000);
  }, []);

  const copy = useCallback(
    async (text: string) => {
      const ok = await writeClipboard(text);
      if (ok) show(t('toast.copied'));
      else show(t('toast.copyFailed'), text);
      return ok;
    },
    [show],
  );

  return (
    <ToastContext.Provider value={{ show, copy }}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => (
          <div className="toast" key={toast.id}>
            <span className="toast-line">
              <Icon name={toast.fallback ? 'warn' : 'check'} />
              {toast.message}
            </span>
            {toast.fallback && <FallbackField text={toast.fallback} />}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast outside ToastProvider');
  return ctx;
}
