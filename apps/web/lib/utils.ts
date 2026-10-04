import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
/** Merge conditional Tailwind classes; later conflicting utilities take precedence. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
