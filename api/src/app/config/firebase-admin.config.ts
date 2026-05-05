export default () => ({
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    databaseId: process.env.FIREBASE_DATABASE_ID || 'subwars-5', // Default to subwars-5
  },
});

