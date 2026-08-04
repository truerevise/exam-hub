import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDQPGrwNBGS1EOdOg6t3uyuby0IDQwO9Uw",
  authDomain: "exam-hub-db0eb.firebaseapp.com",
  projectId: "exam-hub-db0eb",
  storageBucket: "exam-hub-db0eb.firebasestorage.app",
  messagingSenderId: "836139140800",
  appId: "1:836139140800:web:e6d6414a584acabbc18f25"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
