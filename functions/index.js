const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { buildNotificationPayload, sendWebPush, isUnrecoverablePushError } = require("./notifications");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

const NOTIFICATION_RETENTION_HOURS = 24;
const MAX_BATCH_DELETE = 500;
const DEFAULT_REGION = "europe-west1";
const CPH_TIMEZONE = "Europe/Copenhagen";
const DEN_AABNE_CHANNEL_ID = "RFYoEHhScYOkDaIbGSYA";
const DRINK_MILESTONES = [5, 10, 15, 20, 25, 30];
// Fixed reminder times: 20:00, 23:00, and 02:00 local time
const REMINDER_TIMES = [20, 23, 2];
const USAGE_REMINDER_CRON = "0 20,23,2 * * *"; // Run at 20:00, 23:00, and 02:00

/**
 * Resets the checkInStatus field for all users to false and clears currentLocation.
 * This logic is shared between the scheduled function and the manual trigger.
 */
async function resetAllUsersCheckInStatus() {
    const usersRef = db.collection("users");
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
        console.log("No users found to reset.");
        return;
    }

    const bulkWriter = db.bulkWriter();

    snapshot.docs.forEach((doc) => {
        bulkWriter.update(doc.ref, {
            checkInStatus: false,
            currentLocation: null,
        });
    });

    await bulkWriter.close();
    console.log(`Successfully reset checkInStatus for ${snapshot.size} users.`);
}

/**
 * Scheduled function that runs every day at 00:00 and 12:00 Europe/Copenhagen time.
 */
exports.resetCheckInStatus = functions
    .region("europe-west1") // Set region to europe-west1 (or preferred region)
    .pubsub.schedule("0 0,12 * * *")
    .timeZone("Europe/Copenhagen")
    .onRun(async (context) => {
        console.log("Running scheduled reset of checkInStatus...");
        await resetAllUsersCheckInStatus();
        console.log("Scheduled reset completed.");
        return null;
    });

/**
 * Manual trigger for development and testing purposes.
 * Can be called via HTTP or Firebase Console.
 */
exports.manualResetCheckInStatus = functions
    .region("europe-west1")
    .https.onRequest(async (req, res) => {
        try {
            console.log("Running manual reset of checkInStatus...");
            await resetAllUsersCheckInStatus();
            res.status(200).send("Successfully reset checkInStatus for all users.");
        } catch (error) {
            console.error("Error resetting checkInStatus:", error);
            res.status(500).send("Error resetting checkInStatus.");
        }
    });

/**
 * Delete all messages older than 24 hours from all channels.
 * Runs daily at 12:00 Europe/Copenhagen time.
 */
async function deleteOldMessages() {
    const cutoffTime = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    );

    console.log(`Deleting messages older than ${cutoffTime.toDate().toISOString()}`);

    // Get all channels
    const channelsRef = db.collection("channels");
    const channelsSnapshot = await channelsRef.get();

    if (channelsSnapshot.empty) {
        console.log("No channels found.");
        return { deletedCount: 0 };
    }

    let totalDeleted = 0;
    const bulkWriter = db.bulkWriter();

    // Process each channel
    for (const channelDoc of channelsSnapshot.docs) {
        const channelId = channelDoc.id;
        const messagesRef = channelDoc.ref.collection("messages");

        // Query messages older than 24 hours
        const oldMessagesQuery = messagesRef
            .where("timestamp", "<", cutoffTime)
            .limit(500); // Process in batches to avoid timeout

        const messagesSnapshot = await oldMessagesQuery.get();

        messagesSnapshot.docs.forEach((messageDoc) => {
            bulkWriter.delete(messageDoc.ref);
            totalDeleted++;
        });
    }

    await bulkWriter.close();
    console.log(`Successfully deleted ${totalDeleted} old messages.`);

    return { deletedCount: totalDeleted };
}

/**
 * Scheduled function that deletes old messages daily at 12:00 Europe/Copenhagen time.
 */
exports.deleteOldMessages = functions
    .region("europe-west1")
    .pubsub.schedule("0 10 * * *") // Every day at 10:00
    .timeZone("Europe/Copenhagen")
    .onRun(async (context) => {
        console.log("Running scheduled deletion of old messages...");
        try {
            const result = await deleteOldMessages();
            console.log(`Scheduled message deletion completed. Deleted ${result.deletedCount} messages.`);
            return null;
        } catch (error) {
            console.error("Error deleting old messages:", error);
            throw error;
        }
    });

/**
 * Manual trigger for development and testing purposes.
 * Can be called via HTTP or Firebase Console to delete old messages.
 */
exports.manualDeleteOldMessages = functions
    .region("europe-west1")
    .https.onRequest(async (req, res) => {
        try {
            console.log("Running manual deletion of old messages...");
            const result = await deleteOldMessages();
            res.status(200).json({
                success: true,
                deletedCount: result.deletedCount,
                message: `Successfully deleted ${result.deletedCount} old messages.`
            });
        } catch (error) {
            console.error("Error deleting old messages:", error);
            res.status(500).json({
                success: false,
                error: error.message || "Error deleting old messages."
            });
        }
    });

/**
 * Delete notification items older than 24 hours for every user.
 * Runs daily at 12:00 Europe/Copenhagen time.
 */
async function deleteOldNotifications() {
    const cutoffTime = admin.firestore.Timestamp.fromDate(
        new Date(Date.now() - NOTIFICATION_RETENTION_HOURS * 60 * 60 * 1000)
    );

    console.log(`[notifications] Starting deletion of items older than ${cutoffTime.toDate().toISOString()}`);

    const notificationsRef = db.collection("notifications");
    const usersSnapshot = await notificationsRef.get();

    if (usersSnapshot.empty) {
        console.log("[notifications] No notification documents found.");
        return { deletedCount: 0, usersProcessed: 0 };
    }

    console.log(`[notifications] Found ${usersSnapshot.size} users with notification documents.`);

    let totalDeleted = 0;
    let usersProcessed = 0;
    let usersWithErrors = 0;

    for (const userDoc of usersSnapshot.docs) {
        const userId = userDoc.id;
        const itemsRef = userDoc.ref.collection("items");
        let deletedForUser = 0;
        let batchCount = 0;

        // Create a new bulkWriter for each user to ensure proper isolation
        const bulkWriter = db.bulkWriter();

        // Add error handling for bulkWriter operations
        bulkWriter.onWriteError((error) => {
            console.error(`[notifications] BulkWriter error for user ${userId}:`, error);
        });

        try {
            // Continue deleting until no more old items are found
            while (true) {
                batchCount++;
                const itemsSnapshot = await itemsRef
                    .where("timestamp", "<", cutoffTime)
                    .limit(MAX_BATCH_DELETE)
                    .get();

                if (itemsSnapshot.empty) {
                    console.log(`[notifications] User ${userId}: No more old items found after ${batchCount - 1} batches.`);
                    break;
                }

                console.log(`[notifications] User ${userId}: Batch ${batchCount} - Found ${itemsSnapshot.size} old items to delete.`);

                // Queue all deletions in this batch
                itemsSnapshot.docs.forEach((itemDoc) => {
                    bulkWriter.delete(itemDoc.ref);
                    deletedForUser += 1;
                    totalDeleted += 1;
                });

                // Flush this batch to ensure deletions are committed
                await bulkWriter.flush();
                console.log(`[notifications] User ${userId}: Batch ${batchCount} - Flushed ${itemsSnapshot.size} deletions.`);

                // If we got fewer items than the limit, we've reached the end
                if (itemsSnapshot.size < MAX_BATCH_DELETE) {
                    console.log(`[notifications] User ${userId}: Reached end of old items (got ${itemsSnapshot.size} < ${MAX_BATCH_DELETE}).`);
                    break;
                }
            }

            // Close the bulkWriter for this user
            await bulkWriter.close();

            if (deletedForUser > 0) {
                console.log(`[notifications] User ${userId}: Successfully deleted ${deletedForUser} old items across ${batchCount} batches.`);
                usersProcessed++;
            } else {
                console.log(`[notifications] User ${userId}: No old items found to delete.`);
            }
        } catch (error) {
            usersWithErrors++;
            console.error(`[notifications] Failed to delete items for user ${userId}:`, error);
            // Try to close bulkWriter even on error
            try {
                await bulkWriter.close();
            } catch (closeError) {
                console.error(`[notifications] Error closing bulkWriter for user ${userId}:`, closeError);
            }
        }
    }

    console.log(`[notifications] Cleanup completed. Total deleted: ${totalDeleted} items across ${usersProcessed} users. Errors: ${usersWithErrors}.`);

    return { deletedCount: totalDeleted, usersProcessed, usersWithErrors };
}

exports.deleteOldNotifications = functions
    .region("europe-west1")
    .pubsub.schedule("0 10 * * *") // Every day at 10:00
    .timeZone("Europe/Copenhagen")
    .onRun(async () => {
        console.log("[notifications] Running scheduled deletion of old notification items...");
        try {
            const result = await deleteOldNotifications();
            console.log(`[notifications] Scheduled notification cleanup completed. Deleted ${result.deletedCount} items across ${result.usersProcessed} users. Errors: ${result.usersWithErrors || 0}.`);
            return null;
        } catch (error) {
            console.error("[notifications] Error deleting old notification items", error);
            throw error;
        }
    });

exports.manualDeleteOldNotifications = functions
    .region("europe-west1")
    .https.onRequest(async (req, res) => {
        try {
            console.log("[notifications] Running manual deletion of old notification items...");
            const result = await deleteOldNotifications();
            res.status(200).json({
                success: true,
                deletedCount: result.deletedCount,
                usersProcessed: result.usersProcessed || 0,
                usersWithErrors: result.usersWithErrors || 0,
                message: `Successfully deleted ${result.deletedCount} old notification items across ${result.usersProcessed || 0} users.`
            });
        } catch (error) {
            console.error("[notifications] Manual deletion error", error);
            res.status(500).json({
                success: false,
                error: error.message || "Error deleting old notification items."
            });
        }
    });

async function loadChannel(channelId) {
    if (!channelId) return null;
    const snap = await db.collection("channels").doc(channelId).get();
    return snap.exists ? { id: snap.id, ...snap.data() } : null;
}

async function loadRecipients(channelId, senderId) {
    const snapshot = await db
        .collection("users")
        .where("joinedChannelIds", "array-contains", channelId)
        .get();
    return snapshot.docs.filter((docSnap) => docSnap.id !== senderId);
}

async function loadSubscriptionsForUser(userDoc) {
    const subsSnap = await userDoc.ref.collection("pushSubscriptions").get();
    return subsSnap.docs;
}

async function notifySubscriptions(subDocs, payload) {
    const results = await Promise.allSettled(
        subDocs.map(async (docSnap) => {
            const subscription = {
                endpoint: docSnap.get("endpoint"),
                keys: docSnap.get("keys")
            };
            if (!subscription.endpoint || !subscription.keys) {
                await docSnap.ref.delete().catch(() => { });
                return { status: "skipped" };
            }
            try {
                await sendWebPush(subscription, payload);
                await docSnap.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => { });
                return { status: "sent" };
            } catch (error) {
                console.error("[push] send error", { subscriptionId: docSnap.id, error: error.message });
                if (isUnrecoverablePushError(error)) {
                    await docSnap.ref.delete().catch(() => { });
                }
                return { status: "failed", error };
            }
        })
    );

    return results.reduce((acc, result) => {
        if (result.status === "fulfilled") {
            if (result.value?.status === "sent") acc.sent += 1;
            if (result.value?.status === "failed") acc.failed += 1;
            if (result.value?.status === "skipped") acc.skipped += 1;
        } else {
            acc.failed += 1;
        }
        return acc;
    }, { sent: 0, failed: 0, skipped: 0 });
}

function isChannelExcluded(channelId) {
    return !channelId || channelId === DEN_AABNE_CHANNEL_ID;
}

function getDisplayName(userData = {}) {
    return (
        userData.fullName ||
        userData.displayName ||
        userData.username ||
        userData.name ||
        "En ven"
    );
}

function getHighestMilestone(before = 0, after = 0) {
    const previous = Number.isFinite(before) ? before : 0;
    const current = Number.isFinite(after) ? after : 0;
    if (current <= previous) {
        return null;
    }
    const reached = DRINK_MILESTONES.filter((value) => current >= value && previous < value);
    if (!reached.length) {
        return null;
    }
    return Math.max(...reached);
}

function getCopenhagenTime(date = new Date()) {
    const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: CPH_TIMEZONE,
        hour: "numeric",
        minute: "numeric",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour12: false
    });
    const parts = formatter.formatToParts(date);
    const hour = parseInt(parts.find(p => p.type === "hour").value, 10);
    const minute = parseInt(parts.find(p => p.type === "minute").value, 10);
    const year = parseInt(parts.find(p => p.type === "year").value, 10);
    const month = parseInt(parts.find(p => p.type === "month").value, 10);
    const day = parseInt(parts.find(p => p.type === "day").value, 10);
    return { hour, minute, year, month, day };
}

/**
 * Gets the current reminder time slot identifier.
 * Format: "YYYY-MM-DD_HH" (e.g., "2024-01-15_20" for 20:00 on Jan 15)
 * For 02:00, it uses the current date (which is the next day from 23:00 perspective).
 * Returns null if not at one of the fixed reminder times (20:00, 23:00, 02:00).
 */
function getCurrentReminderSlot(date = new Date()) {
    const { hour, minute, year, month, day } = getCopenhagenTime(date);
    // Only return a slot if we're exactly at one of the reminder times (minute must be 0)
    if (!REMINDER_TIMES.includes(hour) || minute !== 0) {
        return null;
    }
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return `${dateStr}_${String(hour).padStart(2, '0')}`;
}

/**
 * Checks if the current time matches one of the fixed reminder times (20:00, 23:00, 02:00).
 */
function isAtReminderTime(date = new Date()) {
    const { hour, minute } = getCopenhagenTime(date);
    return REMINDER_TIMES.includes(hour) && minute === 0;
}

async function writeNotificationItem(userId, payload, extra = {}) {
    if (!userId || !payload) {
        return;
    }
    const itemsRef = db.collection("notifications").doc(userId).collection("items");
    const doc = {
        type: payload.data?.type || "generic",
        title: payload.title || "",
        body: payload.body || "",
        data: payload.data || {},
        channelId: payload.data?.channelId || null,
        read: false,
        timestamp: FieldValue.serverTimestamp(),
        ...extra
    };
    try {
        await itemsRef.add(doc);
    } catch (error) {
        console.error("[notifications] Failed to persist notification item", { userId, error: error.message });
    }
}

async function deliverNotificationToUserDoc(userDoc, payload, feedExtra = {}) {
    if (!userDoc?.exists) {
        return { sent: 0, failed: 0, skipped: 1 };
    }
    const userId = userDoc.id;
    await writeNotificationItem(userId, payload, feedExtra);
    const subDocs = await loadSubscriptionsForUser(userDoc);
    if (!subDocs.length) {
        return { sent: 0, failed: 0, skipped: 1 };
    }
    return notifySubscriptions(subDocs, payload);
}

async function deliverNotificationToUserDocs(userDocs, payload, feedExtra) {
    const totals = { sent: 0, failed: 0, skipped: 0 };
    const getFeedData =
        typeof feedExtra === "function"
            ? feedExtra
            : () => feedExtra || {};

    for (const doc of userDocs) {
        const extra = getFeedData(doc);
        const result = await deliverNotificationToUserDoc(doc, payload, extra);
        totals.sent += result.sent;
        totals.failed += result.failed;
        totals.skipped += result.skipped;
    }

    return totals;
}

exports.onChannelMessageCreated = functions
    .region("europe-west1")
    .firestore.document("channels/{channelId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
        const message = snap.data();
        const channelId = context.params.channelId;

        if (!message || !channelId) {
            console.warn("[push] Missing message data or channelId");
            return null;
        }

        const channel = await loadChannel(channelId);
        const channelName = channel?.name || "din kanal";
        const senderId = message.userId;
        const senderName = message.userName || "En ven";
        const preview = (message.content || "").slice(0, 120);

        const recipients = await loadRecipients(channelId, senderId);
        if (!recipients.length) {
            console.log("[push] No recipients for message", { channelId, messageId: context.params.messageId });
            return null;
        }

        const payload = buildNotificationPayload("new_message", {
            channelId,
            channelName,
            senderName,
            preview,
            messageId: context.params.messageId,
            data: {
                url: `/home?channel=${channelId}`
            }
        });

        let totals = { sent: 0, failed: 0, skipped: 0 };

        for (const recipient of recipients) {
            const subDocs = await loadSubscriptionsForUser(recipient);
            if (!subDocs.length) {
                continue;
            }
            const result = await notifySubscriptions(subDocs, payload);
            totals.sent += result.sent;
            totals.failed += result.failed;
            totals.skipped += result.skipped;
        }

        console.log("[push] new_message completed", {
            channelId,
            messageId: context.params.messageId,
            recipients: recipients.length,
            sent: totals.sent,
            failed: totals.failed,
            skipped: totals.skipped
        });

        return null;
    });

async function maybeSendCheckInNotification(userId, beforeData = {}, afterData = {}) {
    const wasCheckedIn = !!beforeData.checkInStatus;
    const isCheckedIn = !!afterData.checkInStatus;

    if (wasCheckedIn || !isCheckedIn) {
        return;
    }

    const channelId = afterData.activeChannelId;
    if (isChannelExcluded(channelId)) {
        return;
    }

    const channel = await loadChannel(channelId);
    if (!channel) {
        console.warn("[notifications] check_in skipped, channel missing", { userId, channelId });
        return;
    }

    const recipients = await loadRecipients(channelId, userId);
    if (!recipients.length) {
        console.log("[notifications] check_in no recipients", { channelId, userId });
        return;
    }

    const userName = getDisplayName(afterData);
    const payload = buildNotificationPayload("check_in", {
        channelId,
        channelName: channel.name || "din kanal",
        userId,
        userName,
        data: {
            url: `/home?channel=${channelId}`
        }
    });

    await deliverNotificationToUserDocs(recipients, payload, {
        channelId,
        actorId: userId,
        actorName: userName,
        type: "check_in"
    });

    console.log("[notifications] check_in delivered", {
        channelId,
        userId,
        recipients: recipients.length
    });
}

async function maybeSendDrinkMilestoneNotification(userId, beforeData = {}, afterData = {}, userSnapshot) {
    const beforeCount = Number(beforeData.currentRunDrinkCount || 0);
    const afterCount = Number(afterData.currentRunDrinkCount || 0);
    const milestone = getHighestMilestone(beforeCount, afterCount);

    if (!milestone) {
        return;
    }

    const channelId = afterData.activeChannelId || null;

    // Only send notifications if user is in a valid channel (not excluded)
    if (isChannelExcluded(channelId)) {
        return;
    }

    const channel = await loadChannel(channelId);
    if (!channel) {
        console.warn("[notifications] drink_milestone skipped, channel missing", { userId, channelId });
        return;
    }

    const channelName = channel.name || "din kanal";
    const userName = getDisplayName(afterData);

    // Get all channel members except the user who triggered the milestone
    // Also exclude members who are in "Den Åbne Kanal" (even if they're also in this channel)
    const allRecipients = await loadRecipients(channelId, userId);
    const recipients = allRecipients.filter((docSnap) => {
        const userData = docSnap.data();
        const joinedChannelIds = userData.joinedChannelIds || [];
        // Exclude users who are members of "Den Åbne Kanal"
        return !joinedChannelIds.includes(DEN_AABNE_CHANNEL_ID);
    });

    if (!recipients.length) {
        console.log("[notifications] drink_milestone no recipients", { channelId, userId });
        return;
    }

    const context = {
        userId,
        userName,
        milestone,
        channelId,
        channelName,
        data: {
            summary: `${userName} har nået ${milestone} drinks`
        }
    };

    // Send notification to other channel members (not to the user who triggered it)
    const fanOutPayload = buildNotificationPayload("drink_milestone", context);
    await deliverNotificationToUserDocs(recipients, fanOutPayload, {
        channelId,
        milestone,
        actorId: userId,
        actorName: userName,
        type: "drink_milestone"
    });

    console.log("[notifications] drink_milestone delivered to channel", {
        userId,
        channelId,
        milestone,
        recipients: recipients.length
    });
}

exports.onUserActivityUpdated = functions
    .region(DEFAULT_REGION)
    .firestore.document("users/{userId}")
    .onUpdate(async (change, context) => {
        const before = change.before.data() || {};
        const after = change.after.data() || {};
        const userId = context.params.userId;

        await maybeSendCheckInNotification(userId, before, after);
        await maybeSendDrinkMilestoneNotification(userId, before, after, change.after);

        return null;
    });

exports.sendUsageReminders = functions
    .region(DEFAULT_REGION)
    .pubsub.schedule(USAGE_REMINDER_CRON)
    .timeZone(CPH_TIMEZONE)
    .onRun(async () => {
        const now = new Date();
        const currentSlot = getCurrentReminderSlot(now);

        if (!currentSlot) {
            console.log("[notifications] usage_reminder skipped - not at a reminder time");
            return null;
        }

        const checkedInUsers = await db
            .collection("users")
            .where("checkInStatus", "==", true)
            .get();

        if (checkedInUsers.empty) {
            console.log("[notifications] usage_reminder no checked-in users");
            return null;
        }

        let notified = 0;
        let skipped = 0;

        for (const userDoc of checkedInUsers.docs) {
            try {
                const data = userDoc.data();
                const channelId = data.activeChannelId || null;
                if (isChannelExcluded(channelId)) {
                    skipped += 1;
                    continue;
                }

                // Check if user has checked in (eligibility requirement)
                const lastCheckIn = data.lastCheckIn?.toDate?.() ?? null;
                if (!lastCheckIn) {
                    skipped += 1;
                    continue;
                }

                // Check if reminder was already sent for this time slot
                const lastReminderSlot = data.lastUsageReminderSlot || null;
                if (lastReminderSlot === currentSlot) {
                    skipped += 1;
                    continue;
                }

                const userId = userDoc.id;
                const payload = buildNotificationPayload("usage_reminder", {
                    userId,
                    channelId,
                    data: {
                        message: "Hop tilbage i Sladesh og log næste drink"
                    }
                });

                await deliverNotificationToUserDoc(userDoc, payload, {
                    channelId,
                    type: "usage_reminder"
                });

                // Update both the slot identifier and timestamp for tracking
                await userDoc.ref.update({
                    lastUsageReminderSlot: currentSlot,
                    lastUsageReminderAt: FieldValue.serverTimestamp()
                });

                notified += 1;
            } catch (error) {
                skipped += 1;
                console.error("[notifications] usage_reminder failed for user", {
                    userId: userDoc.id,
                    error: error.message
                });
            }
        }

        console.log("[notifications] usage_reminder cycle completed", {
            slot: currentSlot,
            notified,
            skipped,
            checkedIn: checkedInUsers.size
        });

        return null;
    });

/**
 * Sends a notification when a Sladesh challenge is created.
 * Triggered when a document is created in the sladeshChallenges collection.
 */
exports.onSladeshSent = functions
    .region(DEFAULT_REGION)
    .firestore.document("sladeshChallenges/{challengeId}")
    .onCreate(async (snap, context) => {
        const challenge = snap.data();
        const challengeId = context.params.challengeId;

        if (!challenge || !challenge.receiverId) {
            console.warn("[sladesh] Missing challenge data or receiverId", { challengeId });
            return null;
        }

        console.log("[sladesh] Processing new Sladesh challenge", {
            challengeId,
            senderId: challenge.senderId,
            receiverId: challenge.receiverId
        });

        try {
            // Get receiver's user document
            const receiverDoc = await db.collection("users").doc(challenge.receiverId).get();

            if (!receiverDoc.exists) {
                console.warn("[sladesh] Receiver not found", { receiverId: challenge.receiverId });
                return null;
            }

            const senderName = challenge.senderName || "En ven";
            const channelId = challenge.channelId || null;

            if (channelId === DEN_AABNE_CHANNEL_ID) {
                console.log("[sladesh] Skipping notification for Den Åbne Kanal", {
                    challengeId,
                    channelId
                });
                return null;
            }

            // Build notification payload
            const payload = buildNotificationPayload("sladesh_received", {
                senderId: challenge.senderId,
                senderName,
                sladeshId: challengeId,
                channelId
            });

            // Send notification to receiver
            const result = await deliverNotificationToUserDoc(receiverDoc, payload, {
                channelId,
                senderId: challenge.senderId,
                senderName,
                type: "sladesh_received"
            });

            console.log("[sladesh] Notification delivered", {
                challengeId,
                receiverId: challenge.receiverId,
                sent: result.sent,
                failed: result.failed,
                skipped: result.skipped
            });

            return null;
        } catch (error) {
            console.error("[sladesh] Error sending notification", {
                challengeId,
                error: error.message
            });
            return null;
        }
    });

/**
 * Sends a notification to the sender when a Sladesh challenge is completed.
 * Triggered when a document in sladeshChallenges transitions to status "completed".
 */
exports.onSladeshCompleted = functions
    .region(DEFAULT_REGION)
    .firestore.document("sladeshChallenges/{challengeId}")
    .onUpdate(async (change, context) => {
        const before = change.before.data() || {};
        const after = change.after.data() || {};
        const challengeId = context.params.challengeId;

        const beforeStatus = (before.status || "").toString().toLowerCase();
        const afterStatus = (after.status || "").toString().toLowerCase();

        if (afterStatus !== "completed" || beforeStatus === "completed") {
            return null;
        }

        const senderId = after.senderId;
        const receiverId = after.receiverId;
        const receiverName = after.recipientName || after.receiverName || "En ven";
        const channelId = after.channelId || null;

        if (!senderId) {
            console.warn("[sladesh] Missing senderId on completion", { challengeId });
            return null;
        }

        if (channelId === DEN_AABNE_CHANNEL_ID) {
            console.log("[sladesh] Skipping completion notification for Den Åbne Kanal", {
                challengeId,
                channelId
            });
            return null;
        }

        try {
            const senderDoc = await db.collection("users").doc(senderId).get();
            if (!senderDoc.exists) {
                console.warn("[sladesh] Sender not found on completion", { senderId, challengeId });
                return null;
            }

            const payload = buildNotificationPayload("sladesh_completed", {
                receiverId,
                receiverName,
                sladeshId: challengeId,
                channelId
            });

            const result = await deliverNotificationToUserDoc(senderDoc, payload, {
                channelId,
                receiverId,
                type: "sladesh_completed",
                sladeshId: challengeId
            });

            console.log("[sladesh] Completion notification delivered", {
                challengeId,
                senderId,
                sent: result.sent,
                failed: result.failed,
                skipped: result.skipped
            });

            return null;
        } catch (error) {
            console.error("[sladesh] Error sending completion notification", {
                challengeId,
                error: error.message
            });
            return null;
        }
    });
