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

window.FIREBASE_CONFIG = {
	apiKey: process.env.FIREBASE_API_KEY || '',
	authDomain: process.env.FIREBASE_AUTH_DOMAIN || 'quanlyindulieu.firebaseapp.com',
	databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://quanlyindulieu-default-rtdb.firebaseio.com',
	projectId: process.env.FIREBASE_PROJECT_ID || 'quanlyindulieu',
	storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'quanlyindulieu.firebasestorage.app',
	messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || '612738369968',
	appId: process.env.FIREBASE_APP_ID || '1:612738369968:web:d75b65fea0bea94a22ae75',
	measurementId: process.env.FIREBASE_MEASUREMENT_ID || 'G-31BGRMCMQ3'
};
