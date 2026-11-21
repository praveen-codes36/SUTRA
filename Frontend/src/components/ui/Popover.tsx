import React, { useEffect, useId, useRef, useState } from 'react';

export interface PopoverProps {
  trigger: (props: {
    onClick: () => void;
    'aria-expanded': boolean;
    'aria-controls': string;
  }) => React.ReactNode;
  children: React.ReactNode;
  align?: 'left' | 'right';
  className?: string;
}

export const Popover: React.FC<PopoverProps> = ({
  trigger,
  children,
  align = 'right',
  className = '',
}) => {
  const id = useId();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerElRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    triggerElRef.current = document.activeElement as HTMLElement | null;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerElRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative inline-flex ${className}`}>
      {trigger({
        onClick: () => setOpen((p) => !p),
        'aria-expanded': open,
        'aria-controls': id,
      })}
      {open && (
        <div
          id={id}
          className={`absolute top-full z-40 mt-2 min-w-[260px] rounded-[8px] border border-[#7B8581] bg-white p-3 shadow-[var(--shadow-overlay)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          {children}
        </div>
      )}
    </div>
  );
};
