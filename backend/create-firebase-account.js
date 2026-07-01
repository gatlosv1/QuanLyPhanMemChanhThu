require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const crypto = require('crypto');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, addDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.FIREBASE_DATABASE_URL,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID,
  measurementId: process.env.FIREBASE_MEASUREMENT_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

(async () => {
  const username = 'KhuSX';
  const password = '200695';
  const passwordHash = crypto.createHash('sha256').update(password, 'utf8').digest('hex');
  const q = query(collection(db, 'accounts'), where('username', '==', username));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    console.log('Account already exists:', snapshot.docs[0].id);
    return;
  }

  const docRef = await addDoc(collection(db, 'accounts'), {
    username,
    passwordHash,
    role: 'admin',
    page: 'index.html',
    label: 'index.html',
    createdAt: new Date().toISOString()
  });

  console.log('Account created with id:', docRef.id);
})().catch((error) => {
  console.error('Failed to create Firebase account:', error);
  process.exit(1);
});
