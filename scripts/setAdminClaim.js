// One-off script to grant a real Firebase Auth custom claim (admin: true)
// to a user, so the Realtime Database rules (which check
// `auth.token.admin === true`) accept their writes.
//
// Setup:
//   1. npm install --save-dev firebase-admin
//   2. Firebase console > Project settings > Service accounts >
//      Generate new private key. Save the JSON somewhere OUTSIDE the repo
//      (never commit it), e.g. ~/secrets/elsheikh-service-account.json
//   3. Run:
//      GOOGLE_APPLICATION_CREDENTIALS=~/secrets/elsheikh-service-account.json \
//        node scripts/setAdminClaim.js someone@example.com
//
// After running, the user must sign out and back in (or force a token
// refresh) so their ID token picks up the new claim.

const admin = require('firebase-admin');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/setAdminClaim.js <user-email>');
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.applicationDefault(),
});

(async () => {
  try {
    const user = await admin.auth().getUserByEmail(email);
    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log(`Set admin: true claim for ${email} (uid: ${user.uid})`);
    console.log('Ask them to sign out and sign back in for it to take effect.');
  } catch (error) {
    console.error('Failed to set custom claim:', error.message);
    process.exit(1);
  }
})();
