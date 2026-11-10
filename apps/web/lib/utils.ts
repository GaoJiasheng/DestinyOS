import { clsx, type ClassValue } from 'clsx';
/**
 * Join conditional class names. Components use semantic CSS classes rather than
 * conflicting Tailwind utilities, so tailwind-merge (~10KB gzip in every route) is not needed.
 */
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}
