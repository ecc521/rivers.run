export const isFirebaseEmulatorEnabled = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

export const getStorageUrl = (path: string) => {
  if (isFirebaseEmulatorEnabled) {
    // URL-encode the path component so we don't break the query string syntax on emulator
    return `http://127.0.0.1:9199/v0/b/rivers-run.appspot.com/o/${encodeURIComponent(path)}?alt=media`;
  }
  return `https://storage.googleapis.com/rivers-run.appspot.com/${path}`;
};
