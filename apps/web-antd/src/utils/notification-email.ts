/** Preserve the notification form's basic email contract without regex backtracking. */
export function isBasicNotificationEmail(value: string): boolean {
  const text = value.trim();
  if (/\s/.test(text)) return false;
  const at = text.indexOf('@');
  if (at <= 0 || at !== text.lastIndexOf('@')) return false;
  const domain = text.slice(at + 1);
  // The original check permits dots in either domain part, including a trailing dot.
  const separator = domain.indexOf('.', 1);
  return separator > 0 && separator < domain.length - 1;
}
