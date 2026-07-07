const env = (typeof window !== 'undefined' && window.__ENV__) ||
  (typeof process !== 'undefined' && process.env ? process.env : {});

window.FIREBASE_CONFIG = {
	apiKey: env.FIREBASE_API_KEY,
	authDomain: env.FIREBASE_AUTH_DOMAIN,
	databaseURL: env.FIREBASE_DATABASE_URL,
	projectId: env.FIREBASE_PROJECT_ID,
	storageBucket: env.FIREBASE_STORAGE_BUCKET,
	messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
	appId: env.FIREBASE_APP_ID,
	measurementId: env.FIREBASE_MEASUREMENT_ID
};

const requiredFirebaseKeys = [
	'apiKey',
	'authDomain',
	'databaseURL',
	'projectId',
	'storageBucket',
	'messagingSenderId',
	'appId'
];

const missingFirebaseKeys = requiredFirebaseKeys.filter((key) => !window.FIREBASE_CONFIG[key]);
if (missingFirebaseKeys.length > 0) {
	console.error('Missing Firebase env keys:', missingFirebaseKeys.join(', '));
}
