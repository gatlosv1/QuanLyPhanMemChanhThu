const requiredFirebaseKeys = [
	'apiKey',
	'authDomain',
	'databaseURL',
	'projectId',
	'storageBucket',
	'messagingSenderId',
	'appId'
];

function toFirebaseConfig(env) {
	return {
		apiKey: env.FIREBASE_API_KEY,
		authDomain: env.FIREBASE_AUTH_DOMAIN,
		databaseURL: env.FIREBASE_DATABASE_URL,
		projectId: env.FIREBASE_PROJECT_ID,
		storageBucket: env.FIREBASE_STORAGE_BUCKET,
		messagingSenderId: env.FIREBASE_MESSAGING_SENDER_ID,
		appId: env.FIREBASE_APP_ID,
		measurementId: env.FIREBASE_MEASUREMENT_ID
	};
}

function getMissingFirebaseKeys(config) {
	return requiredFirebaseKeys.filter((key) => !config[key]);
}

function setRuntimeConfig(config) {
	window.FIREBASE_CONFIG = config;
	return config;
}

function readConfigFromWindowOrProcess() {
	const env = (typeof window !== 'undefined' && window.__ENV__) ||
		(typeof process !== 'undefined' && process.env ? process.env : {});
	return toFirebaseConfig(env || {});
}

async function fetchConfigFromBackend() {
	if (typeof fetch === 'undefined') return null;
	try {
		const response = await fetch('/env.json', { cache: 'no-store' });
		if (!response.ok) return null;
		const env = await response.json();
		if (typeof window !== 'undefined') {
			window.__ENV__ = Object.assign({}, window.__ENV__ || {}, env || {});
		}
		return toFirebaseConfig(env || {});
	} catch (error) {
		return null;
	}
}

window.getRuntimeConfig = async function getRuntimeConfig() {
	const directConfig = readConfigFromWindowOrProcess();
	if (getMissingFirebaseKeys(directConfig).length === 0) {
		return setRuntimeConfig(directConfig);
	}

	const backendConfig = await fetchConfigFromBackend();
	if (backendConfig && getMissingFirebaseKeys(backendConfig).length === 0) {
		return setRuntimeConfig(backendConfig);
	}

	const missingKeys = getMissingFirebaseKeys(directConfig);
	console.error('Missing Firebase env keys:', missingKeys.join(', '));
	return setRuntimeConfig(directConfig);
};

setRuntimeConfig(readConfigFromWindowOrProcess());
