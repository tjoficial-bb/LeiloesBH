import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Test updating a property with only allowed fields
updateDoc(doc(db, 'imoveis', 'test-id'), {
  valor_avaliacao: 'R$ 100.000,00',
  last_updated: new Date().toISOString()
}).then(() => {
  console.log('Success');
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
