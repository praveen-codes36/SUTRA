import React from 'react';
import { Logo } from './Logo';

export interface WordmarkProps {
  variant?: 'onLight' | 'onDark';
  showDevanagari?: boolean;
  compact?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const Wordmark: React.FC<WordmarkProps> = ({
  variant = 'onLight',
  showDevanagari = false,
  compact = false,
  size = 'md',
  className = '',
}) => {
  const isDark = variant === 'onDark';
  const logoSize = size === 'sm' ? 24 : size === 'lg' ? 36 : 30;
  const wordClass =
    size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-xl' : 'text-base';

  return (
    <span className={`inline-flex items-center gap-2.5 shrink-0 ${className}`}>
      <Logo variant={variant} size={logoSize} decorative />
      {!compact && (
        <span className="inline-flex flex-col leading-none">
          <span
            className={`font-display font-bold tracking-[0.14em] whitespace-nowrap ${wordClass} ${
              isDark ? 'text-[#F5F2EA]' : 'text-[#102D2A]'
            }`}
          >
            SUTRA
          </span>
          {showDevanagari && (
            <span
              lang="sa"
              className={`mt-0.5 text-[11px] font-medium tracking-normal leading-tight ${
                isDark ? 'text-[#B8C4BE]' : 'text-[#5A6560]'
              }`}
              style={{ fontFamily: 'var(--font-devanagari)' }}
            >
              सूत्र
            </span>
          )}
        </span>
      )}
    </span>
  );
};
