/**
 * Calculates the number of days between a given date and today
 * @param dateString - Date string in ISO format (YYYY-MM-DD)
 * @returns number of days since the given date
 */
export function calculateDaysSinceDate(dateString: string): number {
  const givenDate = new Date(dateString);
  const today = new Date();
  const diffTime = Math.abs(today.getTime() - givenDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
} 