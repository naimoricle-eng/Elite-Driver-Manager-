import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBmPQ7T6egP_yI7g3C16vWSrgluYV8Irew",
  authDomain: "elitedrivermanager.firebaseapp.com",
  projectId: "elitedrivermanager",
  storageBucket: "elitedrivermanager.firebasestorage.app",
  messagingSenderId: "1027856972050",
  appId: "1:1027856972050:web:38f4959e0dd5bb592d9bcb"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);

console.log("Firebase Berjaya Disambungkan!");