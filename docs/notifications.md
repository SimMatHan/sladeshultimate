## SladeshUltimate Push + Messaging Reference

This document summarizes every moving part in the notification stack so future notification types (or maintenance tasks such as message cleanup) can be implemented quickly.

---

### 1. Components at a Glance

| Layer | Files | Responsibility |
| --- | --- | --- |
| **Frontend (Vite PWA)** | `apps/web/src/push.js`, `apps/web/src/components/AppShell.jsx`, `apps/web/src/pages/NotificationsDebug.jsx`, `apps/web/public/sw.js` | Permission UX, subscription management, debug tooling, service worker display logic |
| **API (Vercel)** | `apps/api/api/sendPush.js`, `apps/api/lib/notificationTemplates.js` | Authenticated push endpoint with CORS + notification payload builder |
| **Firebase Functions** | `functions/index.js`, `functions/notifications.js` | Trigger on new messages, per-user subscription fan-out, scheduled cleanup routines |
| **Data storage** | Firestore `users/{uid}/pushSubscriptions/{hash}` | Stores each user’s Web Push subscription JSON + metadata |

---

### 2. Environment & Secrets

| Context | Variables | Notes |
| --- | --- | --- |
| **Frontend** (`.env.local`, `.env`) | `VITE_VAPID_PUBLIC_KEY`, `VITE_VAPID_PRIVATE_KEY`, `VITE_API_BASE` | Public key is bundled. Private key is only needed locally when generating future key pairs; do *not* expose it in production builds. `VITE_API_BASE` must point at Vercel API origin. |
| **Vercel API** | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Same key pair as frontend. Configured via Vercel project settings. |
| **Firebase Functions** | `functions:config:set vapid.public="…" vapid.private="…"` | Run via Firebase CLI. Required for `notifications.js` to send push notifications. |

> **Key rotation:** If you ever change the VAPID key pair, update all three contexts and redeploy. Users must re-run “Opret/opdater subscription” afterwards so the new key is stored on their devices.

---

### 3. Firestore Data Model

```
users/{uid}
  pushSubscriptions/{subscriptionHash}
    endpoint: string
    keys: { p256dh, auth }
    expirationTime: number|null
    metadata: { userAgent, platform, ... }
    createdAt / updatedAt / lastUsedAt (timestamps)
  activeChannelId: string|null
  currentRunDrinkCount: number
  lastUsageReminderAt: timestamp|null   // updated by usage reminder scheduler
```

- Documents are keyed by `SHA-256(endpoint)` so repeated refreshes overwrite the same device instead of duplicating entries.
- Security rules (in `firestore.rules`) allow users to read/write only their own `pushSubscriptions`.

Notifications shown inside the UI are mirrored under `notifications/{userId}/items` so Firestore listeners stay in sync:

```
notifications/{userId}/items/{notificationId}
  type: string                     // e.g. "check_in"
  title: string
  body: string
  data: { channelId, channelName, userId, milestone, ... }
  channelId: string|null
  read: boolean
  timestamp: server timestamp      // cleaned up by deleteOldNotifications
```

- The Den Åbne Kanal (`RFYoEHhScYOkDaIbGSYA`) never receives backend generated notifications. Every trigger below short-circuits if the active channel matches this ID.

---

### 4. Frontend Flow

1. **Permission prompt** (`AppShell.jsx`):
   - Shows a custom modal on first run. Once accepted, it calls `Notification.requestPermission()` and immediately runs `ensurePushSubscription`.
   - The prompt is only shown once per device (`localStorage.sladesh:notificationsPromptShown`).

2. **Subscription lifecycle** (`src/push.js`, `pushSubscriptionService.js`):
   - Ensures the service worker is registered, then subscribes with `VITE_VAPID_PUBLIC_KEY`.
   - Serializes the `PushSubscription` (via `toJSON`) and stores it locally + in Firestore.
   - `removeSubscriptionForCurrentUser` is available if needed for sign-out scenarios.

3. **Service worker** (`public/sw.js`):
   - Displays notifications using payloads `{ title, body, tag, data.url, data.channelId, ... }`.
   - `notificationclick` opens or focuses `/home?channel=<id>` so the channel auto-loads.

4. **Debug/Test screen** (`pages/NotificationsDebug.jsx`):
   - Shows permission state, cached subscription summary, list of stored Firestore entries.
   - Buttons allow re-requesting permission, refreshing the subscription, sending a self-test (calls Vercel API), resetting the prompt flag, and reloading Firestore entries.

---

### 5. Vercel Push API

- **Endpoint:** `POST /api/sendPush`
- **Body:**

  ```json
  {
    "subscription": {...},   // Web Push subscription object
    "type": "test" | "new_message" | ...,
    "title": "override title",
    "body": "override body",
    "tag": "stable-tag",
    "data": { "url": "/", "channelId": "...", "type": "..." },
    "channelName": "...",
    "senderName": "...",
    "preview": "...",
    "messageId": "..."
  }
  ```

- **Behavior:**
  - Validates incoming JSON and ensures env keys exist.
  - Uses `buildNotificationPayload` in `apps/api/lib/notificationTemplates.js` to build consistent payloads for supported `type`s (`test`, `new_message`, future types).
  - Returns `{ ok: true, payload }` or `{ ok: false, error }`.
  - CORS allows `http://localhost:5173`, `https://sladeshultimate-1.web.app`, `https://sladeshultimate-1.firebaseapp.com`.

---

### 6. Firebase Functions

#### `functions/notifications.js`
Reusable helpers for Functions:
- Loads VAPID keys from `process.env` or `functions.config().vapid`.
- `buildNotificationPayload(type, context)` mirrors the Vercel builder.
- `sendWebPush(subscription, payload)` sends via `web-push`.
- `isUnrecoverablePushError` (410/404/401) is used to prune dead subscriptions.

#### `onChannelMessageCreated`
- Trigger: `channels/{channelId}/messages/{messageId}` on create.
- Flow:
  1. Load message + channel metadata.
  2. Fetch users with `joinedChannelIds` containing the channel; skip the sender.
  3. For each recipient, read `pushSubscriptions` and attempt delivery.
  4. Delete dead subscriptions and log totals (`sent`, `failed`, `skipped`).
  5. Payload uses type `new_message` with channel/sender info and a link to `/home?channel=<id>`.

#### `onUserActivityUpdated`
- Trigger: `users/{userId}` on update (region `europe-west1`).
- Responsibilities:
  1. Detects a `checkInStatus` transition (`false → true`) and sends a `check_in` notification to every member of the user's active channel (except the user and Den Åbne Kanal). Payload contains `channelId`, `channelName`, `userId`, and `userName`.
  2. Tracks `currentRunDrinkCount` and emits a `drink_milestone` notification whenever the count crosses 5/10/15/20/25/30. Only the highest milestone crossed per write is emitted, and the user's own notification is always delivered even if the active channel is Den Åbne Kanal.
- Side effects:
  - Persists each notification to `notifications/{userId}/items`.
  - Uses the shared `notifySubscriptions` helper to fan out pushes defensively (bad subscriptions are pruned).

#### `sendUsageReminders`
- Trigger: Pub/Sub schedule `*/15 * * * *` (every 15 minutes, time zone Europe/Copenhagen).
- Guards:
  - Skips executions outside the 10:00–02:00 local window.
  - Only considers users with `checkInStatus == true` and an active channel that is not Den Åbne Kanal.
  - Requires at least 2 hours since `max(lastUsageReminderAt, lastCheckIn)`.
- Actions:
  - Sends a `usage_reminder` notification to the user.
  - Updates `users/{userId}.lastUsageReminderAt` for throttling.
  - Writes the reminder into `notifications/{userId}/items`.

#### Scheduled & Manual maintenance
- `resetCheckInStatus`, `deleteOldMessages`, `deleteOldNotifications`, and their manual equivalents live in `functions/index.js`.
  - `deleteOldMessages` removes channel messages older than 24h (runs daily at 12:00 Europe/Copenhagen).
  - `deleteOldNotifications` prunes `notifications/{userId}/items` entries with `timestamp < now - 24h` (also daily at 12:00 Europe/Copenhagen) so each user only keeps recent items. A manual HTTPS trigger is available for spot checks.
  - If you add new cleanup routines, follow the same pattern and document them here.

---

### 7. Adding a New Notification Type

1. **Design the payload**  
   - Decide on `type`, `title`, `body`, `tag`, and `data` requirements (e.g., deep-link URLs, entity IDs).

2. **Update builders**  
   - `apps/api/lib/notificationTemplates.js` — add a new `builders[key]` entry.
   - `functions/notifications.js` — mirror the same builder so both API and backend use identical logic.

3. **Emit the event**  
   - If it stems from a Firebase trigger, add a new Cloud Function or extend an existing one.
   - If it’s initiated from the client, call the Vercel API with `type` set to your new notification type.

4. **Client handling (optional)**  
   - Adjust the service worker if the new notification requires custom icons or click behavior.
   - Ensure the app route referred to in `data.url` can handle the deep link (e.g., parse `type` / IDs).

5. **Test**  
   - Use the debug screen for manual sends (`type: "test"`). For new types, temporarily expose a button or script. Always verify the Function logs for `sent`/`failed` counts.

---

### 8. Production Notification Types

##### `check_in`
- **Trigger:** `onUserActivityUpdated` when a user's `checkInStatus` flips from `false` to `true`.
- **Audience:** Every member of the user's active channel except the user themself. Channels with ID `RFYoEHhScYOkDaIbGSYA` (Den Åbne Kanal) are always skipped.
- **Data:** `channelId`, `channelName`, `userId`, `userName`, deep link to `/home?channel=<id>`.
- **Persistence:** Each recipient gets a document under `notifications/{recipientId}/items` with `type: "check_in"`.

Example push payload:

```json
{
  "title": "Mia er checket ind",
  "body": "Kom og sig hej i Fredagsbaren",
  "tag": "checkin_a1b2c3",
  "data": {
    "type": "check_in",
    "channelId": "a1b2c3",
    "channelName": "Fredagsbaren",
    "userId": "uid123",
    "userName": "Mia",
    "url": "/home?channel=a1b2c3"
  }
}
```

##### `drink_milestone`
- **Trigger:** `onUserActivityUpdated` whenever `currentRunDrinkCount` crosses 5, 10, 15, 20, 25 or 30. Only the highest milestone crossed in a single write is emitted, so overshooting (e.g. jumping from 4 → 12) sends a single `milestone=10`.
- **Audience:** The user always receives the notification. Members of the active channel also receive it unless the channel is Den Åbne Kanal (or `activeChannelId` is missing).
- **Data:** Includes `milestone`, `channelId`, `channelName`, `userId`, `userName`, plus a `summary` string so the UI can show a short preview.
- **State:** Relies on `currentRunDrinkCount` resets at 10:00 and the user's `activeChannelId`.

Channel-facing payload example:

```json
{
  "title": "Jonas ramte 15 drinks",
  "body": "Hold dampen oppe i Klubben",
  "tag": "milestone_15_klubben",
  "data": {
    "type": "drink_milestone",
    "milestone": 15,
    "channelId": "klubben",
    "channelName": "Klubben",
    "userId": "uid456",
    "userName": "Jonas",
    "summary": "Jonas har nået 15 drinks",
    "url": "/home?channel=klubben"
  }
}
```

##### `usage_reminder`
- **Trigger:** `sendUsageReminders` scheduled function (every 15 minutes, Europe/Copenhagen). Runs only when the local time is between 10:00 and 02:00 and at least 2 hours have passed since the user's last reminder or check-in.
- **Audience:** The checked-in user (active channel must not be Den Åbne Kanal).
- **Data:** `userId`, `channelId`, a short encouragement message, and a deep link back into the active channel.
- **State:** Updates `users/{uid}.lastUsageReminderAt` after each send to enforce the 2-hour cooldown.

Example payload:

```json
{
  "title": "Tid til en Sladesh-update?",
  "body": "Log næste drink eller check ind igen for holdet 🍹",
  "tag": "usage_reminder",
  "data": {
    "type": "usage_reminder",
    "channelId": "fredagsbaren",
    "userId": "uid789",
    "message": "Hop tilbage i Sladesh og log næste drink",
    "url": "/home?channel=fredagsbaren"
  }
}
```

---

### 9. Debugging & Monitoring

1. **Frontend**  
   - Use the notifications debug page for permission/subscription state.
   - `localStorage.sladesh:pushSubscription` holds the cached subscription JSON for quick inspection.

2. **Cloud Functions logs**  
   - Look for `[push] new_message completed` entries.
   - `failed: N` combined with `[push] send error` lines tells you which subscriptions were invalid (missing VAPID keys, 410 gone, etc.).

3. **Vercel API logs**  
   - Check Vercel’s function logs if `/api/sendPush` returns `{ ok: false }`.

4. **Firestore**  
   - Subscriptions are deleted automatically when they fail due to 404/410. If a user stops getting pushes, ask them to refresh their subscription via the debug page.

---

### 10. Housekeeping

- **Rotate VAPID keys** sparingly. If you must, update `.env*`, Vercel, Firebase config, redeploy all layers, then prompt users to refresh subscriptions.
- **Message cleanup** is already scheduled (`deleteOldMessages`). If you add new heavy collections, reuse the same pattern (helper + scheduled + manual HTTP trigger) so the maintenance story stays consistent.
- **Documentation** — Update this file whenever you add notification types or change env expectations so future contributors have a single source of truth.

---

### 11. Implementation Summary & Manual Testing

**Functions & triggers**
- `onUserActivityUpdated` (`users/{userId}` on update, region `europe-west1`)  
  Reads `users`, `channels`, and `users/{uid}/pushSubscriptions`; writes to `notifications/{uid}/items` for every recipient.
- `sendUsageReminders` (Pub/Sub `*/15 * * * *`, Europe/Copenhagen)  
  Reads `users` (filtered by `checkInStatus`), writes `notifications/{uid}/items`, and updates `users/{uid}.lastUsageReminderAt`.

**Firestore touch-points**
- Reads: `users`, `channels`, `users/{uid}/pushSubscriptions`.
- Writes: `notifications/{uid}/items`, `users/{uid}.lastUsageReminderAt`.

**Manual testing checklist**
- `check_in`  
  1. Log in two test users that share a channel other than Den Åbne Kanal.  
  2. Check in user A via the app (or update `checkInStatus` through the check-in UI).  
  3. Confirm user B receives a push + new document under `notifications/{userB}/items` with `type: "check_in"`.
- `drink_milestone`  
  1. Reset user A's `currentRunDrinkCount` via the existing reset tooling if needed.  
  2. Log drinks until the next milestone (5/10/15/20/25/30) is crossed in one increment.  
  3. Verify user A and any non-Den channel members get exactly one `drink_milestone` notification, and that `notifications/{userId}/items` contains the matching entry.
- `usage_reminder`  
  1. Check in a user assigned to a non-Den channel.  
  2. Ensure `lastUsageReminderAt` is older than 2 hours (clear it or set it manually).  
  3. Run `sendUsageReminders` via `firebase functions:shell` or wait for the next cron window between 10:00–02:00.  
  4. Confirm the user receives the reminder and `lastUsageReminderAt` updates.

---

### Quick Reference Checklist

- [ ] Frontend env: `VITE_VAPID_PUBLIC_KEY`, `VITE_API_BASE`
- [ ] Vercel env: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
- [ ] Firebase Functions config: `vapid.public`, `vapid.private`
- [ ] Firestore rules allow `/users/{uid}/pushSubscriptions/{id}`
- [ ] Service worker deployed with latest click-handling logic
- [ ] Debug screen verified in both dev & prod
- [ ] Cloud Function logs show `sent: N`, `failed: 0`

Keep this doc handy whenever you need to ship a new notification or revisit backend fan-out logic. Updates welcome!***

