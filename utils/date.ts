// Returns "YYYY-MM-DD" using the DEVICE'S LOCAL calendar date — not UTC.
// Date.prototype.toISOString() would convert to UTC first, which can flip
// to the wrong day near midnight depending on the student's timezone. This
// builds the string from the local year/month/day fields instead.
export function getLocalDateString(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getFriendlyDateLabel(date: Date = new Date()): string {
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}
