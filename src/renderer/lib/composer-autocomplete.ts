export type ComposerAutocompleteKind = 'slash' | 'path';

export interface ComposerAutocompleteTarget {
  kind: ComposerAutocompleteKind;
  query: string;
  tokenStart: number;
  tokenEnd: number;
}

export interface ApplyAutocompleteResult {
  value: string;
  cursor: number;
}

function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

export function extractAutocompleteTarget(input: string, cursor: number): ComposerAutocompleteTarget | null {
  const safeCursor = Math.max(0, Math.min(cursor, input.length));
  if (safeCursor === 0) {
    return null;
  }

  const lineStart = input.lastIndexOf('\n', safeCursor - 1) + 1;
  let tokenStart = safeCursor - 1;
  while (tokenStart >= lineStart) {
    const char = input[tokenStart];
    if (isWhitespace(char)) {
      tokenStart += 1;
      break;
    }
    tokenStart -= 1;
  }

  if (tokenStart < lineStart) {
    tokenStart = lineStart;
  }

  const token = input.slice(tokenStart, safeCursor);
  if (!token) {
    return null;
  }

  if (token.startsWith('/')) {
    const leadingSegment = input.slice(lineStart, tokenStart);
    if (leadingSegment.trim().length > 0) {
      return null;
    }
    return {
      kind: 'slash',
      query: token.slice(1),
      tokenStart,
      tokenEnd: safeCursor,
    };
  }

  if (token.startsWith('@')) {
    return {
      kind: 'path',
      query: token.slice(1),
      tokenStart,
      tokenEnd: safeCursor,
    };
  }

  return null;
}

export function applyAutocompleteReplacement(
  input: string,
  target: ComposerAutocompleteTarget,
  replacement: string,
  appendTrailingSpace: boolean,
): ApplyAutocompleteResult {
  const before = input.slice(0, target.tokenStart);
  const after = input.slice(target.tokenEnd);
  const insertion = appendTrailingSpace ? `${replacement} ` : replacement;
  const value = `${before}${insertion}${after}`;
  return {
    value,
    cursor: before.length + insertion.length,
  };
}

