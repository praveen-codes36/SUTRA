import React from 'react';

export interface SkeletonProps {
  className?: string;
  lines?: number;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '', lines = 1 }) => {
  if (lines <= 1) {
    return (
      <div
        aria-hidden="true"
        className={`animate-pulse rounded-[4px] bg-[#E5E2D9]/80 ${className || 'h-4 w-full'}`}
      />
    );
  }
  return (
    <div aria-hidden="true" className={`flex flex-col gap-2 ${className}`}>
      {Array.from({ length: lines }).map((_, idx) => (
        <div
          key={idx}
          className={`animate-pulse h-4 rounded-[4px] bg-[#E5E2D9]/80 ${
            idx === lines - 1 ? 'w-3/4' : 'w-full'
          }`}
        />
      ))}
    </div>
  );
};
