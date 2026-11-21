import React, { useId } from 'react';
import { Search, X } from 'lucide-react';

export interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
  label?: string;
  className?: string;
  shortcutHint?: string;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  onSubmit,
  placeholder = 'Search emails, threads, decisions…',
  label = 'Search',
  className = '',
  shortcutHint,
}) => {
  const id = useId();

  return (
    <div className={`relative flex items-center ${className}`}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Search
        size={16}
        className="pointer-events-none absolute left-3 text-[#5A6560]"
        aria-hidden="true"
      />
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && onSubmit) {
            e.preventDefault();
            onSubmit();
          }
        }}
        placeholder={placeholder}
        className="min-h-[40px] w-full rounded-[4px] border border-[#7B8581] bg-white pl-9 pr-16 py-2 text-[14px] text-[#202B35] placeholder:text-[#5A6560] focus:border-[#102D2A]"
      />
      <div className="absolute right-2 flex items-center gap-1">
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Clear search"
            className="inline-flex h-7 w-7 items-center justify-center rounded-[4px] text-[#5A6560] hover:bg-[#E8EFEA] hover:text-[#102D2A]"
          >
            <X size={14} aria-hidden="true" />
          </button>
        )}
        {!value && shortcutHint && (
          <kbd className="hidden sm:inline-block rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA] px-1.5 py-0.5 text-[11px] font-medium text-[#5A6560]">
            {shortcutHint}
          </kbd>
        )}
      </div>
    </div>
  );
};
