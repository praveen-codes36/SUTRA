import type { Amount } from '../types/api';

export type AmountDisplayPref = 'original' | 'normalised' | 'both';

export function formatINR(val?: number | null): string {
  if (val === null || val === undefined || Number.isNaN(val)) return '—';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(val);
  } catch {
    return `₹${val.toLocaleString()}`;
  }
}

export function formatAmountValue(amt: Amount, displayPref: AmountDisplayPref = 'both'): string {
  const norm = amt.value_inr != null ? formatINR(amt.value_inr) : null;
  const orig = amt.original_text?.trim() || null;

  if (displayPref === 'original') {
    return orig || norm || '—';
  }
  if (displayPref === 'normalised') {
    return norm || orig || '—';
  }
  // 'both'
  if (norm && orig) {
    if (orig.toLowerCase().includes(norm.replace(/[₹,]/g, '').trim())) {
      return norm;
    }
    return `${norm} (${orig})`;
  }
  return norm || orig || '—';
}

export function formatDateTime(
  iso?: string | null,
  options?: { showUtc?: boolean; dateOnly?: boolean },
): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;

    if (options?.showUtc) {
      if (options.dateOnly) {
        return d.toISOString().slice(0, 10);
      }
      return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    }

    if (options?.dateOnly) {
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Kolkata',
      }).format(d);
    }

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return iso;
  }
}

export function formatDateShort(
  iso?: string | null,
  options?: { showUtc?: boolean },
): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    if (options?.showUtc) {
      return d.toISOString().slice(0, 10);
    }
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      timeZone: 'Asia/Kolkata',
    }).format(d);
  } catch {
    return iso;
  }
}

export function formatUtcTooltip(iso?: string | null): string {
  if (!iso) return 'No timestamp available';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return `UTC: ${d.toISOString().replace('T', ' ').slice(0, 19)} · IST: ${formatDateTime(iso, { showUtc: false })}`;
  } catch {
    return iso;
  }
}

export function formatFileSize(bytes?: number | null): string {
  if (bytes === null || bytes === undefined || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

export function getTimeOfDayGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
