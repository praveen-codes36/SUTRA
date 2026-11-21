import React from 'react';
import { locateQuote } from '../../lib/quote';

export interface CodeQuoteProps {
  body: string;
  quote?: string | null;
  className?: string;
}

export const CodeQuote: React.FC<CodeQuoteProps> = ({ body, quote, className = '' }) => {
  const range = quote ? locateQuote(body, quote) : null;

  return (
    <div className={className}>
      {quote && !range && (
        <p className="mb-2 rounded-[4px] border border-[#8A5A00]/30 bg-[#FBF0D9] px-3 py-1.5 text-[12px] font-medium text-[#8A5A00]">
          Quoted passage could not be located in this message
        </p>
      )}
      <div className="email-measure whitespace-pre-wrap break-words rounded-[4px] border border-[#E5E2D9] bg-[#F5F2EA]/50 px-4 py-3 text-[#202B35]">
        {range ? (
          <>
            {body.slice(0, range.start)}
            <mark className="rounded-[2px] bg-[#FBF0D9] px-0.5 text-[#102D2A] ring-1 ring-[#7A5C1E]/40">
              {body.slice(range.start, range.end)}
            </mark>
            {body.slice(range.end)}
          </>
        ) : (
          body
        )}
      </div>
    </div>
  );
};
