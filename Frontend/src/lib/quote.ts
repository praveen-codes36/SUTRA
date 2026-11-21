export function locateQuote(
  body: string,
  quote: string,
): { start: number; end: number } | null {
  if (!body || !quote) return null;

  const exactIdx = body.indexOf(quote);
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + quote.length };
  }

  // Case-insensitive direct search
  const lowerBody = body.toLowerCase();
  const lowerQuote = quote.toLowerCase();
  const lowerIdx = lowerBody.indexOf(lowerQuote);
  if (lowerIdx !== -1) {
    return { start: lowerIdx, end: lowerIdx + quote.length };
  }

  // Trimmed quote search
  const trimmedQuote = quote.trim();
  if (trimmedQuote && trimmedQuote !== quote) {
    const trimmedIdx = body.indexOf(trimmedQuote);
    if (trimmedIdx !== -1) {
      return { start: trimmedIdx, end: trimmedIdx + trimmedQuote.length };
    }
  }

  // Collapsed whitespace search
  const normalizeWs = (s: string) => s.replace(/\s+/g, ' ');
  const normQuote = normalizeWs(trimmedQuote.toLowerCase());
  if (!normQuote) return null;

  // Simple token regex matching
  try {
    const escaped = normQuote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    const regex = new RegExp(escaped, 'i');
    const match = regex.exec(body);
    if (match) {
      return { start: match.index, end: match.index + match[0].length };
    }
  } catch {
    // Fall back to null if regex construction fails
  }

  return null;
}
