# Notifikationssystem - Komplet Oversigt

Dette dokument beskriver alle notifikationstyper i SladeshUltimate applikationen, hvordan de bliver trigget, og hvilke data de indeholder.

## Arkitektur

Notifikationssystemet består af tre hovedkomponenter:

1. **Notification Templates** ([`apps/api/lib/notificationTemplates.js`](file:///c:/Users/SMH/sladeshultimate/apps/api/lib/notificationTemplates.js) og [`functions/notifications.js`](file:///c:/Users/SMH/sladeshultimate/functions/notifications.js))
   - Definerer strukturen for hver notifikationstype
   - Bygger payload med titel, body, tag og data

2. **Firebase Functions** ([`functions/index.js`](file:///c:/Users/SMH/sladeshultimate/functions/index.js))
   - Lytter til Firestore events (onCreate, onUpdate)
   - Sender push notifikationer via web-push
   - Gemmer notifikationer i Firestore (`notifications/{userId}/items`)

3. **Client-side Service** ([`apps/web/src/services/notificationService.js`](file:///c:/Users/SMH/sladeshultimate/apps/web/src/services/notificationService.js))
   - Henter og viser notifikationer i UI
   - Real-time subscription til notifikationer
   - Håndterer sletning af notifikationer

---

## Notifikationstyper

### 1. Test Notifikation

**Type:** `test`

**Beskrivelse:** Bruges til at teste notifikationssystemet.

**Trigger:**
- Manuelt trigget til test-formål
- Ingen automatisk trigger

**Payload:**
```javascript
{
  title: "Sladesh test",
  body: "Det virker! 🎉",
  tag: "test",
  data: {
    type: "test",
    url: "/"
  }
}
```

**Filer involveret:**
- [`apps/api/lib/notificationTemplates.js:4-13`](file:///c:/Users/SMH/sladeshultimate/apps/api/lib/notificationTemplates.js#L4-L13)
- [`functions/notifications.js:7-16`](file:///c:/Users/SMH/sladeshultimate/functions/notifications.js#L7-L16)

---

### 2. Ny Besked (New Message)

**Type:** `new_message`

**Beskrivelse:** Sendes når en bruger modtager en ny besked i en kanal.

**Trigger:**
- **Firebase Function:** `onChannelMessageCreated`
- **Event:** `onCreate` på `channels/{channelId}/messages/{messageId}`
- **Betingelse:** Sendes til alle medlemmer af kanalen undtagen afsenderen

**Hvordan det virker:**
1. En bruger sender en besked i en kanal
2. Firestore onCreate event trigges
3. Firebase Function henter alle kanalmedlemmer (undtagen afsenderen)
4. Notifikation sendes til hver modtager via deres push subscriptions

**Payload:**
```javascript
{
  title: "Ny besked i [kanal navn]",
  body: "[afsender navn]: [besked preview]",
  tag: "channel_[channelId]",
  data: {
    type: "new_message",
    channelId: "...",
    messageId: "...",
    url: "/home?channel=[channelId]"
  }
}
```

**Filer involveret:**
- Template: [`apps/api/lib/notificationTemplates.js:14-32`](file:///c:/Users/SMH/sladeshultimate/apps/api/lib/notificationTemplates.js#L14-L32)
- Function: [`functions/index.js:483-541`](file:///c:/Users/SMH/sladeshultimate/functions/index.js#L483-L541)

---

### 3. Check-In Notifikation

**Type:** `check_in`

**Beskrivelse:** Sendes når en bruger checker ind på et sted.

**Trigger:**
- **Firebase Function:** `onUserActivityUpdated` → `maybeSendCheckInNotification`
- **Event:** `onUpdate` på `users/{userId}`
- **Betingelse:** 
  - Brugerens `checkInStatus` ændres fra `false` til `true`
  - Brugeren er i en gyldig kanal (ikke "Den Åbne Kanal")

**Hvordan det virker:**
1. Bruger checker ind via [`addCheckIn`](file:///c:/Users/SMH/sladeshultimate/apps/web/src/services/userService.js#L627-L641) i `userService.js`
2. User document opdateres med `checkInStatus: true`
3. Firestore onUpdate event trigges
4. Function tjekker om check-in status ændrede sig
5. Notifikation sendes til alle andre medlemmer i samme kanal

**Payload:**
```javascript
{
  title: "[bruger navn] er checket ind",
  body: "Kom forbi [kanal navn]",
  tag: "checkin_[channelId]",
  data: {
    type: "check_in",
    channelId: "...",
    channelName: "...",
    userId: "...",
    userName: "...",
    url: "/home?channel=[channelId]"
  }
}
```

**Filer involveret:**
- Template: [`apps/api/lib/notificationTemplates.js:33-51`](file:///c:/Users/SMH/sladeshultimate/apps/api/lib/notificationTemplates.js#L33-L51)
- Function: [`functions/index.js:543-591`](file:///c:/Users/SMH/sladeshultimate/functions/index.js#L543-L591)
- Client trigger: [`apps/web/src/services/userService.js:627-641`](file:///c:/Users/SMH/sladeshultimate/apps/web/src/services/userService.js#L627-L641)

---

### 4. Drink Milestone Notifikation

**Type:** `drink_milestone`

**Beskrivelse:** Sendes når en bruger når en drink milepæl (5, 10, 15, 20, 25, 30 drinks).

**Trigger:**
- **Firebase Function:** `onUserActivityUpdated` → `maybeSendDrinkMilestoneNotification`
- **Event:** `onUpdate` på `users/{userId}`
- **Betingelse:**
  - Brugerens `currentRunDrinkCount` øges og krydser en milepæl
  - Brugeren er i en gyldig kanal (ikke "Den Åbne Kanal")
  - Modtagere må ikke være medlemmer af "Den Åbne Kanal"

**Hvordan det virker:**
1. Bruger logger en drink via [`addDrink`](file:///c:/Users/SMH/sladeshultimate/apps/web/src/services/userService.js#L473-L535) i `userService.js`
2. User document opdateres med øget `currentRunDrinkCount`
3. Firestore onUpdate event trigges
4. Function beregner om en milepæl blev nået
5. Notifikation sendes til andre kanalmedlemmer

**Milepæle:** 5, 10, 15, 20, 25, 30 drinks

**Payload:**
```javascript
{
  title: "[bruger navn] ramte [milestone] drinks",
  body: "Hold festen kørende i [kanal navn]",
  tag: "milestone_[milestone]_[channelId]",
  data: {
    type: "drink_milestone",
    milestone: 10,
    channelId: "...",
    channelName: "...",
    userId: "...",
    summary: "[bruger navn] har nået [milestone] drinks",
    url: "/home?channel=[channelId]"
  }
}
```

**Filer involveret:**
- Template: [`apps/api/lib/notificationTemplates.js:52-71`](file:///c:/Users/SMH/sladeshultimate/apps/api/lib/notificationTemplates.js#L52-L71)
- Function: [`functions/index.js:593-660`](file:///c:/Users/SMH/sladeshultimate/functions/index.js#L593-L660)
- Client trigger: [`apps/web/src/services/userService.js:473-535`](file:///c:/Users/SMH/sladeshultimate/apps/web/src/services/userService.js#L473-L535)

---

### 5. Usage Reminder Notifikation

**Type:** `usage_reminder`

**Beskrivelse:** Påmindelse til brugere der er checket ind om at logge drinks eller opdatere deres status.

**Trigger:**
- **Firebase Function:** `sendUsageReminders`
- **Event:** Scheduled (cron job)
- **Tidspunkter:** Kl. 14:00, 16:00, 18:00, 20:00, 22:00, 00:00 og 02:00 (Europe/Copenhagen tid)
- **Betingelse:**
  - Brugeren har `checkInStatus: true`
  - Brugeren er i en gyldig kanal (ikke "Den Åbne Kanal")
  - Brugeren har ikke modtaget reminder i det aktuelle tidsvindue

**Hvordan det virker:**
1. Cron job kører tre gange dagligt (20:00, 23:00, 02:00)
2. Function finder alle brugere med `checkInStatus: true`
3. Tjekker om bruger allerede har modtaget reminder i dette tidsvindue
4. Sender notifikation til berettigede brugere
5. Opdaterer `lastUsageReminderSlot` og `lastUsageReminderAt` på user document

**Payload:**
```javascript
{
  title: "Tid til en Sladesh-update?",
  body: "Log næste drink 🍹",
  tag: "usage_reminder",
  data: {
    type: "usage_reminder",
    channelId: "...",
    userId: "...",
    message: "Hop tilbage i Sladesh og log næste drink",
    url: "/home?channel=[channelId]"
  }
}
```

**Filer involveret:**
- Template: [`apps/api/lib/notificationTemplates.js:72-86`](file:///c:/Users/SMH/sladeshultimate/apps/api/lib/notificationTemplates.js#L72-L86)
- Function: [`functions/index.js:676-763`](file:///c:/Users/SMH/sladeshultimate/functions/index.js#L676-L763)

---

### 6. Sladesh Modtaget (Sladesh Received)

**Type:** `sladesh_received`

**Beskrivelse:** Sendes når en bruger modtager en Sladesh udfordring.

**Trigger:**
- **Firebase Function:** `onSladeshSent`
- **Event:** `onCreate` på `sladeshChallenges/{challengeId}`
- **Betingelse:**
  - Challenge document oprettes i Firestore
  - Kanalen er ikke "Den Åbne Kanal"

**Hvordan det virker:**
1. Bruger sender en Sladesh via [`addSladesh`](file:///c:/Users/SMH/sladeshultimate/apps/web/src/services/userService.js#L657-L712) i `userService.js`
2. Challenge document oprettes i `sladeshChallenges` collection
3. Firestore onCreate event trigges
4. Function henter modtagerens user document
5. Notifikation sendes til modtageren

**Payload:**
```javascript
{
  title: "[afsender navn] har sendt dig en Sladesh!",
  body: "Åbn appen og gennemfør udfordringen 🍺",
  tag: "sladesh_[sladeshId]",
  data: {
    type: "sladesh_received",
    senderId: "...",
    senderName: "...",
    sladeshId: "...",
    channelId: "...",
    url: "/home?channel=[channelId]"
  }
}
```

**Filer involveret:**
- Template: [`apps/api/lib/notificationTemplates.js:87-105`](file:///c:/Users/SMH/sladeshultimate/apps/api/lib/notificationTemplates.js#L87-L105)
- Function: [`functions/index.js:769-839`](file:///c:/Users/SMH/sladeshultimate/functions/index.js#L769-L839)
- Client trigger: [`apps/web/src/services/userService.js:657-712`](file:///c:/Users/SMH/sladeshultimate/apps/web/src/services/userService.js#L657-L712)

---

### 7. Sladesh Fuldført (Sladesh Completed)

**Type:** `sladesh_completed`

**Beskrivelse:** Sendes til afsenderen når modtageren fuldender en Sladesh udfordring.

**Trigger:**
- **Firebase Function:** `onSladeshCompleted`
- **Event:** `onUpdate` på `sladeshChallenges/{challengeId}`
- **Betingelse:**
  - Challenge `status` ændres til `"completed"`
  - Kanalen er ikke "Den Åbne Kanal"

**Hvordan det virker:**
1. Modtager fuldender Sladesh (opdaterer challenge document status til "completed")
2. Firestore onUpdate event trigges
3. Function tjekker om status ændrede sig til "completed"
4. Notifikation sendes til den oprindelige afsender

**Payload:**
```javascript
{
  title: "[modtager navn] fuldførte din Sladesh",
  body: "Klar til næste udfordring? 🚀",
  tag: "sladesh_completed_[sladeshId]",
  data: {
    type: "sladesh_completed",
    receiverId: "...",
    receiverName: "...",
    sladeshId: "...",
    channelId: "...",
    url: "/home?channel=[channelId]"
  }
}
```

**Filer involveret:**
- Template: [`apps/api/lib/notificationTemplates.js:106-124`](file:///c:/Users/SMH/sladeshultimate/apps/api/lib/notificationTemplates.js#L106-L124)
- Function: [`functions/index.js:845-915`](file:///c:/Users/SMH/sladeshultimate/functions/index.js#L845-L915)

---

## Notifikations Levering

### Push Notification Flow

1. **Oprettelse af Payload:** Template builder konstruerer notifikation payload
2. **Firestore Persistering:** Notifikation gemmes i `notifications/{userId}/items` collection
3. **Push Subscription Lookup:** Henter brugerens push subscriptions fra `users/{userId}/pushSubscriptions`
4. **Web Push Send:** Sender notifikation via web-push til hver subscription
5. **Error Handling:** Sletter ugyldige subscriptions (404, 410, 401 errors)

### Notifikations Opbevaring

**Firestore Path:** `notifications/{userId}/items/{itemId}`

**Document Structure:**
```javascript
{
  type: "check_in",           // Notifikationstype
  title: "...",               // Titel
  body: "...",                // Besked
  data: { ... },              // Ekstra data
  channelId: "...",           // Kanal ID (hvis relevant)
  read: false,                // Læst status
  timestamp: Timestamp        // Oprettelsestidspunkt
}
```

**Retention:** Notifikationer slettes automatisk efter 24 timer via scheduled function `deleteOldNotifications` (kører dagligt kl. 10:00).

---

## Cleanup Jobs

### 1. Delete Old Notifications
- **Function:** `deleteOldNotifications`
- **Schedule:** Dagligt kl. 10:00 (Europe/Copenhagen)
- **Handling:** Sletter notifikationer ældre end 24 timer

### 2. Weekly Firestore Cleanup
- **Function:** `weeklyFirestoreCleanup`
- **Schedule:** Hver mandag kl. 08:00 (Europe/Copenhagen)
- **Handling:** Sletter alle dokumenter i `sladeshChallenges` og `notifications` collections

---

## Samlet Oversigt

| Type | Trigger Event | Frekvens | Modtagere | Ekskluderet Kanal |
|------|--------------|----------|-----------|-------------------|
| `test` | Manuel | On-demand | N/A | Nej |
| `new_message` | Ny besked i kanal | Real-time | Alle kanalmedlemmer (undtagen afsender) | Nej |
| `check_in` | Bruger checker ind | Real-time | Alle kanalmedlemmer (undtagen bruger) | Ja (Den Åbne Kanal) |
| `drink_milestone` | Bruger når milepæl | Real-time | Kanalmedlemmer (ikke i Den Åbne Kanal) | Ja (Den Åbne Kanal) |
| `usage_reminder` | Scheduled cron | 7x dagligt (14:00, 16:00, 18:00, 20:00, 22:00, 00:00, 02:00) | Checkede-ind brugere | Ja (Den Åbne Kanal) |
| `sladesh_received` | Sladesh sendt | Real-time | Modtager | Ja (Den Åbne Kanal) |
| `sladesh_completed` | Sladesh fuldført | Real-time | Afsender | Ja (Den Åbne Kanal) |

---

## Vigtige Konstanter

```javascript
// Notification retention
NOTIFICATION_RETENTION_HOURS = 24

// Den Åbne Kanal (ekskluderet fra notifikationer)
DEN_AABNE_CHANNEL_ID = "RFYoEHhScYOkDaIbGSYA"

// Drink milestones
DRINK_MILESTONES = [5, 10, 15, 20, 25, 30]

// Reminder times (Copenhagen time)
REMINDER_TIMES = [14, 16, 18, 20, 22, 0, 2]  // 14:00, 16:00, 18:00, 20:00, 22:00, 00:00, 02:00
```

---

## Fejlhåndtering

### Push Subscription Errors

**Unrecoverable Errors (subscription slettes automatisk):**
- `404` - Subscription ikke fundet
- `410` - Subscription udløbet
- `401` - Unauthorized

**Handling:**
- Subscription document slettes fra Firestore
- Error logges til console
- Fortsætter med næste subscription

### Notification Delivery Stats

Hver notification delivery returnerer:
```javascript
{
  sent: 5,      // Antal succesfuldt sendte
  failed: 1,    // Antal fejlede
  skipped: 2    // Antal sprunget over
}
```
