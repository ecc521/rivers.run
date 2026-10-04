import { initializeApp } from "firebase/app";
import type { Analytics } from "firebase/analytics";
import {
  initializeAuth,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from "firebase/auth";
import { Capacitor } from "@capacitor/core";

export const firebaseConfig = {
  apiKey: "AIzaSyA8hvftc7idpGNcj5I9gvOqk-DQrTrkQco",
  authDomain: "rivers-run.firebaseapp.com",
  projectId: "rivers-run",
  messagingSenderId: "781093992108",
  appId: "1:781093992108:web:a5a9db5b62f1d554c61109",
  measurementId: "G-ZP92G9QBYB",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
// Web analytics loads once the page has finished loading so it stays off the startup
// path. Native builds skip it: @capacitor-firebase/analytics hooks into the native SDKs.
export const analyticsReady: Promise<Analytics | null> =
  typeof window === "undefined" || Capacitor.isNativePlatform()
    ? Promise.resolve(null)
    : new Promise((resolve) => {
        const start = () =>
          setTimeout(() => {
            import("firebase/analytics")
              .then(({ getAnalytics }) => resolve(getAnalytics(app)))
              .catch(() => resolve(null));
          }, 1000);
        if (document.readyState === "complete") start();
        else window.addEventListener("load", start, { once: true });
      });

// Same persistence as getAuth(), minus the popup/redirect resolver. getAuth() would load
// a hidden iframe from firebaseapp.com on every page view; the resolver is instead passed
// to signInWithPopup() when someone actually signs in.
export const auth = Capacitor.isNativePlatform()
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence })
  : initializeAuth(app, {
      persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence],
    });
