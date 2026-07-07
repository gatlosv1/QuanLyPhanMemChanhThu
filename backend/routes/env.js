// Fallback only: real runtime values should come from /env.js served by backend.
window.__ENV__ = window.__ENV__ || {
  FIREBASE_API_KEY: "",
  FIREBASE_AUTH_DOMAIN: "",
  FIREBASE_DATABASE_URL: "",
  FIREBASE_PROJECT_ID: "",
  FIREBASE_STORAGE_BUCKET: "",
  FIREBASE_MESSAGING_SENDER_ID: "",
  FIREBASE_APP_ID: "",
  FIREBASE_MEASUREMENT_ID: ""
};
