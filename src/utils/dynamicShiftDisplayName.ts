const TECHNICAL_SHIFT_PATTERNS = [
  /^\d{8}-\d{4}$/i,
  /^\d{4}-\d{2}-\d{2}[-_T ]\d{2}:?\d{2}$/i,
  /^slot[-_:]/i,
  /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i,
];

export function isTechnicalShiftName(value?: string | null): boolean {
  const normalized = value?.trim() ?? '';
  if (!normalized) return true;
  return TECHNICAL_SHIFT_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function dynamicShiftDisplayName(
  value?: string | null,
  fallback = 'משמרת',
): string {
  const normalized = value?.trim() ?? '';
  return isTechnicalShiftName(normalized) ? fallback : normalized;
}
