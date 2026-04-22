import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth, initializeAuth, indexedDBLocalPersistence } from "firebase/auth";
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
// Explicitly bypass JS Web Analytics on Native since @capacitor-firebase/analytics provides native iOS/Android hooks 
// automatically and JS Analytics incorrectly defaults to DOM/browsers.
export const analytics = (typeof window !== "undefined" && !Capacitor.isNativePlatform()) 
  ? getAnalytics(app) 
  : null;

// Explicitly initialize auth for native platforms to prevent gapi.iframes default browser loading
export const auth = Capacitor.isNativePlatform() 
  ? initializeAuth(app, { persistence: indexedDBLocalPersistence }) 
  : getAuth(app);


