import React from 'react';
import { Info } from 'lucide-react';
import { ROLE_SOURCE_META } from '../../lib/semantics';
import type { Person } from '../../types/api';

export interface RolePillProps {
  person: Person | null | undefined;
  unknownLabel?: string;
  showAddressInline?: boolean;
  className?: string;
}

export const RolePill: React.FC<RolePillProps> = ({
  person,
  unknownLabel = 'Owner not stated',
  showAddressInline = false,
  className = '',
}) => {
  if (!person) {
    return (
      <span className={`text-[13px] text-[#5A6560] italic ${className}`}>
        {unknownLabel}
      </span>
    );
  }

  const primaryLabel = person.role || person.address;
  const inferred = person.role_source === 'INFERRED_FROM_ADDRESS';
  const roleMeta = person.role_source ? ROLE_SOURCE_META[person.role_source] : null;
  const titleParts = [person.address];
  if (roleMeta) titleParts.push(roleMeta.tooltip);

  return (
    <span
      title={titleParts.join(' — ')}
      className={`inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 min-w-0 max-w-full text-[13px] text-[#202B35] ${className}`}
    >
      <span className="font-medium text-[#102D2A] break-words">{primaryLabel}</span>
      {showAddressInline && person.role && (
        <span className="text-[12px] text-[#5A6560] font-normal break-all">({person.address})</span>
      )}
      {inferred && (
        <span
          className="inline-flex items-center gap-0.5 rounded-[4px] border border-dashed border-[#7B8581] bg-[#F5F2EA] px-1.5 py-0.5 text-[11px] font-normal text-[#5A6560] whitespace-nowrap shrink-0"
          title="No display name in email; role inferred from address"
        >
          <Info size={11} aria-hidden="true" />
          <span>role inferred from address</span>
        </span>
      )}
    </span>
  );
};
