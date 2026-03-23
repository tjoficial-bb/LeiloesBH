import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json';

const app = initializeApp({ projectId: firebaseConfig.projectId });
const auth = getAuth(app);

auth.createCustomToken('server-cron-job')
  .then((customToken) => {
    console.log('Custom token:', customToken);
  })
  .catch((error) => {
    console.error('Error creating custom token:', error);
  });
