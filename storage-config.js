import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.17.0/firebase-storage.js';

const firebaseConfig = {
  apiKey: 'AIzaSyDQPGrwNBGS1EOdOg6t3uyuby0IDQwO9Uw',
  authDomain: 'exam-hub-db0eb.firebaseapp.com',
  projectId: 'exam-hub-db0eb',
  storageBucket: 'exam-hub-db0eb.firebasestorage.app',
  messagingSenderId: '836139140800',
  appId: '1:836139140800:web:e6d6414a584acabbc18f25'
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
export const storage = getStorage(app);