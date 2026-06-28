import { Capacitor } from '@capacitor/core';

/**
 * Opens a new tab on web (cookies preserved); navigates in-app on native
 * (SFSafariViewController doesn't share WKWebView auth state).
 */
export function openOrNavigate(path: string, navigate: (path: string) => void): void {
  if (Capacitor.isNativePlatform()) {
    navigate(path);
  } else {
    window.open(path, '_blank');
  }
}
