import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

getDocs(collection(db, 'imoveis')).then(snapshot => {
  if (snapshot.empty) {
    console.log('No documents found');
    process.exit(0);
  }
  const docId = snapshot.docs[0].id;
  console.log('Updating document:', docId);
  return updateDoc(doc(db, 'imoveis', docId), {
    valor_avaliacao: 'R$ 100.000,00',
    last_updated: new Date().toISOString()
  });
}).then(() => {
  console.log('Success');
  process.exit(0);
}).catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
