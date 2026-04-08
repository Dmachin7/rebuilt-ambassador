/**
 * ─── STUB: Push Notification Integration ──────────────────────────────────────
 *
 * sendPushNotification
 *   Option A — Firebase Cloud Messaging (FCM):
 *     const admin = require('firebase-admin');
 *     admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
 *     admin.messaging().sendMulticast({ tokens: fcmTokens, notification: { title, body } })
 *     Env: FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL
 *
 *   Option B — Twilio Notify:
 *     Broadcast to a binding group via Twilio Notify service
 *     Env: TWILIO_NOTIFY_SERVICE_SID
 *
 * Note: Store FCM tokens on the User model when ambassadors grant push permission
 *   (add a `fcmToken String?` field to the User Prisma model)
 */

const sendPushNotification = async (userIds, title, body) => {
  // STUB — logs to console, replace with FCM or Twilio Notify
  console.log(`[STUB notifications.js] sendPushNotification → ${userIds.length} users`);
  console.log(`  → TITLE: ${title}`);
  console.log(`  → BODY:  ${body}`);
  return { success: true, mock: true, count: userIds.length };
};

module.exports = { sendPushNotification };
