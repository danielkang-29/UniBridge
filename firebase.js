import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getFirestore }      from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

// Firebase 초기화
const firebaseConfig = {
  apiKey: "AIzaSyDBW_188kA6WEX73dw3Kk3tF3rZ9746UKM",
  authDomain: "unibridge-b06bd.firebaseapp.com",
  projectId: "unibridge-b06bd",
  storageBucket: "unibridge-b06bd.appspot.com",
  messagingSenderId: "405623255959",
  appId: "1:405623255959:web:dbd82ea8512b39f9decad2",
  measurementId: "G-0HEQRN2K98"
};

const appFirebase = initializeApp(firebaseConfig);
const db = getFirestore(appFirebase);

export { db };
