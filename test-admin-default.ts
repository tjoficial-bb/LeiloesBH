import { initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp({ projectId: firebaseConfig.projectId });
const db = getFirestore(app);

db.collection('imoveis').limit(1).get()
  .then(() => console.log('Success default db'))
  .catch(e => console.error('Error default db:', e));
