/**
 * Formats a phone number as user types
 * Input: any string (numbers and non-digits)
 * Output: formatted string in (XXX) XXX-XXXX format
 */
export function formatPhoneNumber(value: string): string {
  // Remove all non-digit characters
  const digits = value.replace(/\D/g, '');

  // Limit to 10 digits (US phone number)
  const limited = digits.slice(0, 10);

  // Format as (XXX) XXX-XXXX
  if (limited.length === 0) return '';
  if (limited.length <= 3) return `(${limited}`;
  if (limited.length <= 6) return `(${limited.slice(0, 3)}) ${limited.slice(3)}`;
  return `(${limited.slice(0, 3)}) ${limited.slice(3, 6)}-${limited.slice(6)}`;
}

/**
 * Extracts only digits from a formatted phone number
 * Useful for sending to API
 */
export function getPhoneDigits(formatted: string): string {
  return formatted.replace(/\D/g, '');
}
