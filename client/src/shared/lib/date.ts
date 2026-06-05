import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

export function formatMessageTime(value: string) {
  return format(parseISO(value), 'HH:mm');
}

export function formatDateGroup(value: string) {
  const date = parseISO(value);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd MMM yyyy');
}

export function formatLastSeen(value: string | null) {
  if (!value) return 'offline';
  return `last seen ${formatDistanceToNow(parseISO(value), { addSuffix: true })}`;
}
