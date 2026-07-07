// Load Firebase config from environment variables when available.
// Fallback values use the current Firebase project settings.
// Create .env file with these variables set:
// FIREBASE_API_KEY
// FIREBASE_AUTH_DOMAIN
// FIREBASE_DATABASE_URL
// FIREBASE_PROJECT_ID
// FIREBASE_STORAGE_BUCKET
// FIREBASE_MESSAGING_SENDER_ID
// FIREBASE_APP_ID
// FIREBASE_MEASUREMENT_ID

const env = (typeof window !== 'undefined' && window.__ENV__) ||
  (typeof process !== 'undefined' && process.env ? process.env : {});

window.FIREBASE_CONFIG = {
	apiKey: env.FIREBASE_API_KEY || 'AIzaSyAG-0znzoNCqe_ergYn4NyMdeqACSWiiUE',
	authDomain: env.FIREBASE_AUTH_DOMAIN || 'quanlychanhthu.firebaseapp.com',
	databaseURL: env.FIREBASE_DATABASE_URL || 'https://quanlychanhthu-default-rtdb.firebaseio.com',
	projectId: env.FIREBASE_PROJECT_ID || 'quanlychanhthu',
	storageBucket: env.FIREBASE_STORAGE_BUCKET || 'quanlychanhthu.firebasestorage.app',
	messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '629444573072',
	appId: env.FIREBASE_APP_ID || '1:629444573072:web:ba178b2510d761fc876515',
	measurementId: env.FIREBASE_MEASUREMENT_ID || 'G-SKGDHF0CTT'
};
