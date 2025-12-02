import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCH8ZyQXxxi1Psd6itOj4C_ksyyagZrdHs",
  authDomain: "microbiz-accounting.firebaseapp.com",
  projectId: "microbiz-accounting",
  storageBucket: "microbiz-accounting.firebasestorage.app",
  messagingSenderId: "258532246326",
  appId: "1:258532246326:web:f1aa5529f522d65526e997",
  measurementId: "G-17ZDJ3JWY8"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);