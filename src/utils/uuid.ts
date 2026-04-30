/**
 * Generates a RFC4122 v4 compliant UUID.
 * Uses crypto.randomUUID() if available, otherwise falls back to a 
 * Math.random based implementation for compatibility with older browsers (like iOS 15.0-15.3).
 */
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && typeof (crypto as any).randomUUID === 'function') {
    return (crypto as any).randomUUID();
  }

  // Fallback for older browsers (e.g. iOS < 15.4)
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
