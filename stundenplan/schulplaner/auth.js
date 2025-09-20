// /stundenplan/schulplaner/auth.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";


// ⛔ Nur DEIN Konto darf rein (eine der beiden Varianten benutzen):
export const ALLOWED_EMAIL = "matyas.szederkenyi@gmail.com";   // ✅ Empfohlen: deine Google-Mail hier eintragen
export const ALLOWED_UID   = "";                      // (Optional) Statt E-Mail: deine Firebase UID hier
function isAllowed(user){
  if (!user) return false;
  if (ALLOWED_UID && user.uid !== ALLOWED_UID) return false;
  if (ALLOWED_EMAIL && user.email !== ALLOWED_EMAIL) return false;
  return true;
}
export { isAllowed };


// Firebase initialisieren
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const provider = new GoogleAuthProvider();

// Nur angemeldete Nutzer dürfen auf Seiten außer login.html
export function requireAuth(){
  return new Promise((resolve)=>{
    onAuthStateChanged(auth, (user)=>{
      if(!user){
        if(!location.pathname.endsWith("login.html")) location.href = "login.html";
        return;
      }
      if(!isAllowed(user)){
        // Falsches Konto → abmelden & zurück zum Login
        signOut(auth).finally(()=> {
          alert("Dieses Konto ist nicht freigeschaltet.");
          location.href = "login.html";
        });
        return;
      }
      resolve(user);
    });
  });
}


export function loginWithGoogle() {
  return signInWithPopup(auth, provider);
}

export function logout() {
  return signOut(auth);
}
