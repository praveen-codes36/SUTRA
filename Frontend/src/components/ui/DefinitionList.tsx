import React from 'react';

export interface DefinitionItem {
  term: string;
  value: React.ReactNode;
}

export interface DefinitionListProps {
  items: DefinitionItem[];
  columns?: 1 | 2;
  className?: string;
}

export const DefinitionList: React.FC<DefinitionListProps> = ({
  items,
  columns = 1,
  className = '',
}) => {
  return (
    <dl
      className={`divide-y divide-[#E5E2D9] ${
        columns === 2 ? 'grid sm:grid-cols-2 sm:divide-y-0 sm:gap-x-6 sm:gap-y-3' : ''
      } ${className}`}
    >
      {items.map((item, idx) => (
        <div
          key={`${item.term}-${idx}`}
          className={
            columns === 2
              ? 'border-b border-[#E5E2D9] pb-2.5'
              : 'grid grid-cols-1 gap-1 py-2.5 sm:grid-cols-[180px_1fr] sm:gap-4'
          }
        >
          <dt className="text-[12px] font-medium text-[#5A6560] font-display">{item.term}</dt>
          <dd className="text-[14px] text-[#202B35]">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};
