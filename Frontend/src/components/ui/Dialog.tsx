import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { getFocusableElements, trapFocusOnKeyDown } from '../../lib/a11y';
import { IconButton } from './IconButton';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
}

export const Dialog: React.FC<DialogProps> = ({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidthClass = 'max-w-[520px]',
}) => {
  const titleId = useId();
  const descId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;

    const timer = window.setTimeout(() => {
      if (dialogRef.current) {
        const focusables = getFocusableElements(dialogRef.current);
        if (focusables.length > 0) focusables[0].focus();
        else dialogRef.current.focus();
      }
    }, 10);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
      } else {
        trapFocusOnKeyDown(e, dialogRef.current);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      previousFocusRef.current?.focus();
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="fixed inset-0 bg-[#102D2A]/45"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={`relative z-10 w-full rounded-[8px] border border-[#7B8581] bg-white shadow-[var(--shadow-overlay)] ${maxWidthClass}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E2D9] px-5 py-4">
          <div>
            <h2 id={titleId} className="font-display text-[18px] font-semibold text-[#102D2A]">
              {title}
            </h2>
            {description && (
              <p id={descId} className="mt-1 text-[13px] text-[#5A6560]">
                {description}
              </p>
            )}
          </div>
          <IconButton label="Close dialog" onClick={onClose} size="sm">
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="px-5 py-4 text-[14px] text-[#202B35]">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[#E5E2D9] bg-[#F5F2EA]/60 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};
