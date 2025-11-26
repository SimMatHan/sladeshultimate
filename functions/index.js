const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { buildNotificationPayload, sendWebPush, isUnrecoverablePushError } = require("./notifications");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

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
    .pubsub.schedule("0 12 * * *") // Every day at 12:00
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
                await docSnap.ref.delete().catch(() => {});
                return { status: "skipped" };
            }
            try {
                await sendWebPush(subscription, payload);
                await docSnap.ref.update({ lastUsedAt: FieldValue.serverTimestamp() }).catch(() => {});
                return { status: "sent" };
            } catch (error) {
                console.error("[push] send error", { subscriptionId: docSnap.id, error: error.message });
                if (isUnrecoverablePushError(error)) {
                    await docSnap.ref.delete().catch(() => {});
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