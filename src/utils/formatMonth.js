// Format YYYY-MM to readable month name
export function formatMonth(monthStr) {
  if (!monthStr) return '';
  const [year, month] = monthStr.split('-');
  const date = new Date(year, month - 1, 1);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}
