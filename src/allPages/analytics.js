// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyA8hvftc7idpGNcj5I9gvOqk-DQrTrkQco",
  authDomain: "rivers-run.firebaseapp.com",
  projectId: "rivers-run",
  storageBucket: "rivers-run.appspot.com",
  messagingSenderId: "781093992108",
  appId: "1:781093992108:web:a5a9db5b62f1d554c61109",
  measurementId: "G-ZP92G9QBYB"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);