import React from 'react';
import { FilterX } from 'lucide-react';
import { getThreadCategoryLabel } from '../../lib/semantics';
import type { TopicItem } from '../../adapters/dataSource';
import type { ThreadListItem } from '../../types/api';
import { Button } from '../ui/Button';
import { DateRange } from '../ui/DateRange';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';

export interface EmailFilterValues {
  q: string;
  sender: string;
  subject: string;
  thread: string;
  category: string;
  att: string;
  date_from: string;
  date_to: string;
}

export interface EmailFilterPanelProps {
  filters: EmailFilterValues;
  threads: ThreadListItem[];
  topics: TopicItem[];
  onChangeFilter: (key: keyof EmailFilterValues, value: string) => void;
  onChangeRange: (range: { from: string; to: string }) => void;
  onClearFilters: () => void;
}

export const EmailFilterPanel: React.FC<EmailFilterPanelProps> = ({
  filters,
  threads,
  topics,
  onChangeFilter,
  onChangeRange,
  onClearFilters,
}) => {
  const hasActiveFilter = Boolean(
    filters.q ||
      filters.sender ||
      filters.subject ||
      filters.thread ||
      filters.category ||
      (filters.att && filters.att !== 'all') ||
      filters.date_from ||
      filters.date_to,
  );

  return (
    <aside
      aria-label="Email filters"
      className="space-y-4 rounded-[8px] border border-[#E5E2D9] bg-white p-4"
    >
      <div className="flex items-center justify-between gap-2 border-b border-[#E5E2D9] pb-2.5">
        <h2 className="font-display text-[14px] font-semibold text-[#102D2A]">Filters</h2>
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            leftIcon={<FilterX size={13} aria-hidden="true" />}
          >
            Clear filters
          </Button>
        )}
      </div>

      <Input
        label="Keyword"
        value={filters.q}
        onChange={(e) => onChangeFilter('q', e.target.value)}
        placeholder="Body, ID, or address…"
      />

      <Input
        label="Sender"
        value={filters.sender}
        onChange={(e) => onChangeFilter('sender', e.target.value)}
        placeholder="Role or email address…"
      />

      <Input
        label="Subject"
        value={filters.subject}
        onChange={(e) => onChangeFilter('subject', e.target.value)}
        placeholder="Subject contains…"
      />

      <Select
        label="Conversation"
        value={filters.thread}
        onChange={(val) => onChangeFilter('thread', val)}
        options={[
          { value: '', label: 'All conversations' },
          ...threads.map((t) => ({
            value: t.thread_key,
            label: `${t.thread_key} · ${t.title || 'Untitled'}`,
          })),
        ]}
      />

      <Select
        label="Topic / category"
        value={filters.category}
        onChange={(val) => onChangeFilter('category', val)}
        options={[
          { value: '', label: 'All topics' },
          ...topics.map((t) => ({
            value: t.category,
            label: getThreadCategoryLabel(t.category),
          })),
        ]}
      />

      <Select
        label="Attachment availability"
        value={filters.att || 'all'}
        onChange={(val) => onChangeFilter('att', val)}
        options={[
          { value: 'all', label: 'All messages' },
          { value: 'yes', label: 'With attachments' },
          { value: 'no', label: 'Without attachments' },
        ]}
      />

      <DateRange
        label="Sent date range"
        from={filters.date_from}
        to={filters.date_to}
        stacked
        onChange={onChangeRange}
      />
    </aside>
  );
};
