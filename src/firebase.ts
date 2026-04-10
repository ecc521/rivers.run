import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

export const firebaseConfig = {
  apiKey: "AIzaSyA8hvftc7idpGNcj5I9gvOqk-DQrTrkQco",
  authDomain: "rivers-run.firebaseapp.com",
  projectId: "rivers-run",
  storageBucket: "rivers-run.appspot.com",
  messagingSenderId: "781093992108",
  appId: "1:781093992108:web:a5a9db5b62f1d554c61109",
  measurementId: "G-ZP92G9QBYB",
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const auth = getAuth(app);

// Explcitly override standard getFirestore to enforce Multi-Tab offline IndexedDb persistence!
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});
export const functions = getFunctions(app, "us-central1");

if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
  console.info("Firebase Emulator mode natively detected! Intercepting Cloud Functions offline.");
  connectFunctionsEmulator(functions, "127.0.0.1", 5001);
}
