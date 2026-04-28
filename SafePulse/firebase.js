import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// TODO: Replace with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyDdijqvKAylSMwcTQWyGYAz-61roKH-7gI",
  authDomain: "safepulse-52add.firebaseapp.com",
  projectId: "safepulse-52add",
  storageBucket: "safepulse-52add.firebasestorage.app",
  messagingSenderId: "609170120",
  appId: "1:609170120:android:a7aeadbde639326bfe2bfd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);
