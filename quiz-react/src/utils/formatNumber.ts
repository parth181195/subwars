/**
 * Format a number in Indian numbering system (lakhs and crores)
 * Indian numbering: groups of 2 digits after the first 3 digits
 * Example: 53000 -> 53,000 | 530000 -> 5,30,000 | 5300000 -> 53,00,000
 * 
 * @param value - The number or string to format
 * @returns Formatted string with Indian-style commas
 */
export function formatIndianNumber(value: string | number): string {
  // Extract numeric value from string (remove currency symbols, spaces, etc.)
  const numStr = typeof value === 'string' 
    ? value.replace(/[^\d]/g, '') 
    : value.toString();
  
  if (!numStr || numStr === '0') {
    return '0';
  }

  // Convert to number to handle leading zeros
  const num = parseInt(numStr, 10);
  if (isNaN(num)) {
    return value.toString();
  }

  // Convert back to string for formatting
  const str = num.toString();
  
  // Indian numbering system: first 3 digits from right, then groups of 2
  if (str.length <= 3) {
    return str;
  }

  // Get the last 3 digits
  const lastThree = str.slice(-3);
  // Get the remaining digits
  const remaining = str.slice(0, -3);
  
  // Format remaining digits in groups of 2
  const formattedRemaining = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  
  return formattedRemaining + ',' + lastThree;
}

/**
 * Format prize pool value - handles currency symbols and Indian formatting
 * Example: "₹53000" -> "₹53,000" | "530000" -> "5,30,000"
 * 
 * @param value - The prize pool value (may include currency symbols)
 * @returns Formatted string with Indian-style commas
 */
export function formatPrizePool(value: string): string {
  if (!value || !value.trim()) {
    return value;
  }

  // Check if value already has formatting (contains commas)
  if (value.includes(',')) {
    return value; // Already formatted, return as is
  }

  // Extract currency symbol if present
  const currencyMatch = value.match(/^([₹$€£¥]|Rs\.?|INR\s*)/i);
  const currency = currencyMatch ? currencyMatch[0] : '';
  const numericPart = value.replace(/^([₹$€£¥]|Rs\.?|INR\s*)/i, '').trim();

  // Extract any suffix (like "+" in "₹4,00,000+")
  const suffixMatch = numericPart.match(/([+\-]|and\s+above|and\s+more)$/i);
  const suffix = suffixMatch ? suffixMatch[0] : '';
  const pureNumeric = numericPart.replace(/([+\-]|and\s+above|and\s+more)$/i, '').trim();

  // Format the numeric part
  const formatted = formatIndianNumber(pureNumeric);

  // Reconstruct with currency and suffix
  return currency + formatted + suffix;
}

