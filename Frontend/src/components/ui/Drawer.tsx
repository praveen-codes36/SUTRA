import React, { useEffect, useId, useRef } from 'react';
import { X } from 'lucide-react';
import { getFocusableElements, trapFocusOnKeyDown } from '../../lib/a11y';
import { IconButton } from './IconButton';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  side?: 'right' | 'left' | 'bottom';
  widthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

const openDrawerStack: string[] = [];

export const Drawer: React.FC<DrawerProps> = ({
  open,
  onClose,
  title,
  subtitle,
  side = 'right',
  widthClass = 'max-w-[560px]',
  children,
  footer,
}) => {
  const drawerId = useId();
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    openDrawerStack.push(drawerId);

    const timer = window.setTimeout(() => {
      if (panelRef.current) {
        const focusables = getFocusableElements(panelRef.current);
        if (focusables.length > 0) {
          focusables[0].focus();
        } else {
          panelRef.current.focus();
        }
      }
    }, 10);

    const onKeyDown = (e: KeyboardEvent) => {
      const isTopmost = openDrawerStack[openDrawerStack.length - 1] === drawerId;
      if (!isTopmost) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else {
        trapFocusOnKeyDown(e, panelRef.current);
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', onKeyDown);
      const idx = openDrawerStack.lastIndexOf(drawerId);
      if (idx !== -1) openDrawerStack.splice(idx, 1);
      previousFocusRef.current?.focus();
    };
  }, [open, drawerId]);

  if (!open) return null;

  const isBottom = side === 'bottom';

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="fixed inset-0 bg-[#102D2A]/40 transition-opacity duration-150"
        aria-hidden="true"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative z-10 flex w-full flex-col bg-white shadow-[var(--shadow-overlay)] ${
          isBottom
            ? 'mt-auto max-h-[85vh] rounded-t-[12px] border-t border-[#E5E2D9]'
            : `h-full ${widthClass} ${
                side === 'right'
                  ? 'ml-auto border-l border-[#E5E2D9]'
                  : 'mr-auto border-r border-[#E5E2D9]'
              }`
        }`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#E5E2D9] px-5 py-4">
          <div className="min-w-0">
            <h2 id={titleId} className="font-display text-[18px] font-semibold text-[#102D2A]">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-[#5A6560] truncate">{subtitle}</p>
            )}
          </div>
          <IconButton label="Close panel" onClick={onClose} size="sm">
            <X size={18} aria-hidden="true" />
          </IconButton>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>

        {footer && (
          <div className="border-t border-[#E5E2D9] bg-[#F5F2EA]/60 px-5 py-3">{footer}</div>
        )}
      </div>
    </div>
  );
};
