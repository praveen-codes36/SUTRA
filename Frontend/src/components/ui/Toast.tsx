import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

export interface ToastItem {
  id: string;
  tone: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message?: string;
}

export interface ToastViewportProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const TONE_STYLE: Record<ToastItem['tone'], { box: string; icon: React.ReactNode }> = {
  info: {
    box: 'border-[#1F5A8A]/35 bg-[#E1ECF5] text-[#1F5A8A]',
    icon: <Info size={16} aria-hidden="true" />,
  },
  success: {
    box: 'border-[#1E6B45]/35 bg-[#E3F1E8] text-[#1E6B45]',
    icon: <CheckCircle2 size={16} aria-hidden="true" />,
  },
  warning: {
    box: 'border-[#8A5A00]/35 bg-[#FBF0D9] text-[#8A5A00]',
    icon: <AlertTriangle size={16} aria-hidden="true" />,
  },
  error: {
    box: 'border-[#A3342B]/35 bg-[#F9E4E1] text-[#A3342B]',
    icon: <XCircle size={16} aria-hidden="true" />,
  },
};

export const ToastViewport: React.FC<ToastViewportProps> = ({ toasts, onDismiss }) => {
  return (
    <div
      aria-live="polite"
      aria-atomic="false"
      className="fixed bottom-4 right-4 z-50 flex w-full max-w-[360px] flex-col gap-2 pointer-events-none"
    >
      {toasts.map((toast) => {
        const style = TONE_STYLE[toast.tone];
        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start gap-2.5 rounded-[8px] border px-3.5 py-3 shadow-[var(--shadow-overlay)] ${style.box}`}
          >
            <span className="mt-0.5 shrink-0">{style.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold leading-snug">{toast.title}</p>
              {toast.message && (
                <p className="mt-0.5 text-[12px] leading-snug opacity-90">{toast.message}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(toast.id)}
              aria-label={`Dismiss notification: ${toast.title}`}
              className="rounded-[4px] p-1 hover:bg-black/5 cursor-pointer"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
