// ============================================================
//  THE PROTEIN NOOK — Firebase Config
// ============================================================
//  SETUP (do this once before deploying):
//
//  1. Go to https://console.firebase.google.com
//  2. Create a new project (e.g. "protein-nook")
//  3. Enable Firestore Database → start in PRODUCTION mode
//  4. Enable Authentication → Sign-in method → Email/Password
//  5. Authentication → Users → Add User
//     Email : admin@proteinnook.com  (or any email you like)
//     Password : (set a strong password — share only with cafe owner)
//  6. Firestore → Rules → paste the rules below → Publish
//  7. Project Settings → General → Your apps → Add web app
//     Copy the firebaseConfig object and replace below.
//
//  FIRESTORE SECURITY RULES (copy-paste into Firebase console):
//  ─────────────────────────────────────────────────────────────
//  rules_version = '2';
//  service cloud.firestore {
//    match /databases/{database}/documents {
//      match /settings/{doc} {
//        allow read: if true;
//        allow write: if request.auth != null;
//      }
//      match /menuState/{item} {
//        allow read: if true;
//        allow write: if request.auth != null;
//      }
//      match /orders/{order} {
//        allow create: if true;
//        allow read, update, delete: if request.auth != null;
//      }
//    }
//  }
// ============================================================

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
// auth is initialized only in admin.js (firebase-auth-compat not loaded on public page)

// ─── Dev Mode ───────────────────────────────────────────────
// Set to true to skip Firebase login and use local mock data.
// IMPORTANT: set back to false before deploying to GitHub Pages!
const DEV_MODE = true;

// ─── Menu Data (source of truth) ───────────────────────────
const MENU = {
  dosas: [
    { id: 'plain-dosa',       name: 'Plain Dosa (2)',          price: 60,  desc: 'Crispy. Delicious. Made for you!',   emoji: '🥞' },
    { id: 'masala-dosa',      name: 'Masala Dosa',             price: 65,  desc: 'Stuffed with spiced potato filling', emoji: '🥞' },
    { id: 'egg-dosa',         name: 'Egg Dosa',                price: 70,  desc: 'Classic dosa with a fresh egg',      emoji: '🍳' },
    { id: 'peserattu',        name: 'Peserattu',               price: 75,  desc: 'Green moong dal dosa',               emoji: '🥞' },
    { id: 'upma-peserattu',   name: 'Upma Peserattu',          price: 90,  desc: 'Peserattu topped with upma',         emoji: '🥞' },
  ],
  omelettes: [
    { id: 'omelette',               name: 'Omelette',                   price: 50, desc: 'Fresh farm eggs, simply done',         emoji: '🍳' },
    { id: 'masala-omelette',        name: 'Masala Omelette',            price: 65, desc: 'Spiced with herbs & veggies',          emoji: '🍳' },
    { id: 'omelette-toast',         name: 'Omelette & Toast',           price: 50, desc: 'A perfect combo meal',                 emoji: '🍳' },
    { id: 'masala-omelette-toast',  name: 'Masala Omelette & Toast',    price: 65, desc: 'Spiced omelette with toasted bread',   emoji: '🍳' },
  ],
  addons: [
    { id: 'extra-ghee',   name: 'Extra Ghee',   price: 10, desc: 'Pure desi ghee',             emoji: '🧈' },
    { id: 'extra-butter', name: 'Extra Butter', price: 10, desc: 'Fresh butter',               emoji: '🧈' },
    { id: 'extra-cheese', name: 'Extra Cheese', price: 20, desc: 'Melted, gooey goodness',     emoji: '🧀' },
    { id: 'normal-tea',   name: 'Normal Tea',   price: 10, desc: 'Hot. Refreshing. Always.',   emoji: '☕' },
  ]
};

const ALL_ITEMS = [...MENU.dosas, ...MENU.omelettes, ...MENU.addons];

// ─── Helpers ────────────────────────────────────────────────
function generateOrderId() {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 4; i++) suffix += chars[Math.floor(Math.random() * chars.length)];
  return `PN-${yy}${mm}${dd}-${suffix}`;
}

function getCurrentSession() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins >= 450 && mins <= 660)  return 'morning'; // 7:30–11:00
  if (mins >= 1050 && mins <= 1350) return 'evening'; // 5:30–10:30
  return 'off-hours';
}

function formatTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', {
    day: '2-digit', month: 'short',
    hour: '2-digit', minute: '2-digit'
  });
}
