// Load Firebase config from environment variables for security
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
	apiKey: env.FIREBASE_API_KEY || 'AIzaSyAiuq6ZQGVTnPfaWy6rEa8AAV1lse-ZuaU',
	authDomain: env.FIREBASE_AUTH_DOMAIN || 'quanlyindulieu.firebaseapp.com',
	databaseURL: env.FIREBASE_DATABASE_URL || 'https://quanlyindulieu-default-rtdb.firebaseio.com',
	projectId: env.FIREBASE_PROJECT_ID || 'quanlyindulieu',
	storageBucket: env.FIREBASE_STORAGE_BUCKET || 'quanlyindulieu.firebasestorage.app',
	messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID || '612738369968',
	appId: env.FIREBASE_APP_ID || '1:612738369968:web:c6c08c19253a78e522ae75',
	measurementId: env.FIREBASE_MEASUREMENT_ID || 'G-JDM9XPHPEQ'
};
