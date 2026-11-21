import React, { useId } from 'react';

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

export interface TabsProps {
  items: TabItem[];
  activeId: string;
  onChange: (id: string) => void;
  ariaLabel?: string;
  className?: string;
}

export const Tabs: React.FC<TabsProps> = ({
  items,
  activeId,
  onChange,
  ariaLabel = 'Sections',
  className = '',
}) => {
  const baseId = useId();

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={`flex items-center gap-1 overflow-x-auto border-b border-[#E5E2D9] ${className}`}
    >
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            id={`${baseId}-tab-${item.id}`}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`relative inline-flex min-h-[44px] lg:min-h-0 items-center gap-2 px-3 py-2.5 text-[13px] font-display font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors duration-150 ${
              active
                ? 'text-[#102D2A] border-b-2 border-[#102D2A] -mb-[1px]'
                : 'text-[#5A6560] hover:text-[#102D2A]'
            }`}
          >
            <span>{item.label}</span>
            {item.count !== undefined && (
              <span className="tabular-nums text-[12px] text-[#5A6560]">
                ({item.count})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
