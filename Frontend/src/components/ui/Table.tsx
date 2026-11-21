import React from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';

export interface TableColumn<T> {
  key: string;
  header: string;
  sortable?: boolean;
  align?: 'left' | 'right';
  widthClass?: string;
  render: (row: T) => React.ReactNode;
}

export interface TableProps<T> {
  caption: string;
  columns: Array<TableColumn<T>>;
  rows: T[];
  rowKey: (row: T, index: number) => string;
  selectedKey?: string | null;
  onRowClick?: (row: T) => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  stickyHeader?: boolean;
  emptyMessage?: string;
  className?: string;
}

export function Table<T>({
  caption,
  columns,
  rows,
  rowKey,
  selectedKey,
  onRowClick,
  sortBy,
  sortDir,
  onSort,
  stickyHeader = true,
  emptyMessage = 'No records match the current filters.',
  className = '',
}: TableProps<T>) {
  return (
    <div className={`w-full overflow-x-auto rounded-[4px] border border-[#E5E2D9] bg-white ${className}`}>
      <table className="w-full border-collapse text-left text-[13px]">
        <caption className="sr-only">{caption}</caption>
        <thead className={stickyHeader ? 'sticky top-0 z-10 bg-[#F5F2EA]' : 'bg-[#F5F2EA]'}>
          <tr className="border-b border-[#E5E2D9]">
            {columns.map((col) => {
              const isSorted = sortBy === col.key;
              return (
                <th
                  key={col.key}
                  scope="col"
                  className={`px-3.5 py-2.5 font-display text-[12px] font-semibold text-[#102D2A] whitespace-nowrap ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  } ${col.widthClass ?? ''}`}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className={`inline-flex items-center gap-1 hover:underline cursor-pointer ${
                        col.align === 'right' ? 'flex-row-reverse' : ''
                      }`}
                    >
                      <span>{col.header}</span>
                      {isSorted ? (
                        sortDir === 'asc' ? (
                          <ArrowUp size={13} aria-hidden="true" />
                        ) : (
                          <ArrowDown size={13} aria-hidden="true" />
                        )
                      ) : (
                        <ArrowUpDown size={13} className="text-[#5A6560]" aria-hidden="true" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E5E2D9]">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-[#5A6560]">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => {
              const key = rowKey(row, idx);
              const selected = selectedKey === key;
              return (
                <tr
                  key={key}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  aria-selected={selected || undefined}
                  className={`transition-colors duration-100 ${
                    onRowClick ? 'cursor-pointer hover:bg-[#E8EFEA]/60' : ''
                  } ${selected ? 'bg-[#E8EFEA]' : 'bg-white'}`}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={`sutra-row-cell px-3.5 py-2.5 align-top text-[#202B35] ${
                        col.align === 'right' ? 'text-right tabular-nums' : ''
                      }`}
                    >
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
