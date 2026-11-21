import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationProps {
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  pageNumber?: number;
  totalEstimate?: number | null;
  pageSize?: number;
  itemCount?: number;
  className?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  pageNumber = 1,
  totalEstimate,
  pageSize = 25,
  itemCount = 0,
  className = '',
}) => {
  const start = itemCount === 0 ? 0 : (pageNumber - 1) * pageSize + 1;
  const end = (pageNumber - 1) * pageSize + itemCount;

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E2D9] pt-3 text-[13px] text-[#5A6560] ${className}`}
    >
      <span className="tabular-nums">
        {itemCount > 0 ? `Showing ${start}–${end}` : 'No items'}
        {typeof totalEstimate === 'number' ? ` of ${totalEstimate}` : ''}
      </span>
      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasPrev}
          onClick={onPrev}
          leftIcon={<ChevronLeft size={14} aria-hidden="true" />}
        >
          Previous
        </Button>
        <span className="tabular-nums px-1 text-[12px]">Page {pageNumber}</span>
        <Button
          variant="secondary"
          size="sm"
          disabled={!hasNext}
          onClick={onNext}
          rightIcon={<ChevronRight size={14} aria-hidden="true" />}
        >
          Next
        </Button>
      </div>
    </div>
  );
};
