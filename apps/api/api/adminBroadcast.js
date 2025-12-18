const webpush = require('web-push')
const { buildNotificationPayload } = require('../lib/notificationTemplates')
const admin = require('firebase-admin')

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    admin.initializeApp()
}

const db = admin.firestore()

// Allow localhost and hosted origins. Keep in sync with frontend fetches.
const ALLOWED_ORIGINS = [
    'http://localhost:5173',
    'https://sladeshultimate-1.web.app',
    'https://sladeshultimate-1.firebaseapp.com',
    'https://sladeshapp.dk',
    'https://www.sladeshapp.dk'
]

const REQUIRED_ENVS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']
let vapidConfigured = false

// Admin user email - same as in frontend config
const ADMIN_EMAIL = 'simonmathiashansen@gmail.com'

function setCors(req, res) {
    const origin = req.headers.origin || ''
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
    res.setHeader('Access-Control-Allow-Origin', allow)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
}

function ensureEnv() {
    const missing = REQUIRED_ENVS.filter((key) => !process.env[key])
    if (missing.length) {
        throw new Error(`Missing Web Push env vars: ${missing.join(', ')}`)
    }
    if (!vapidConfigured) {
        // Sanitize VAPID keys to remove any hidden whitespace characters
        // This handles issues from Vercel dashboard or .env files
        const publicKey = process.env.VAPID_PUBLIC_KEY.replace(/\s+/g, '')
        const privateKey = process.env.VAPID_PRIVATE_KEY.replace(/\s+/g, '')

        // Validate that keys are not empty after sanitization
        if (!publicKey || !privateKey) {
            throw new Error('VAPID keys are empty after removing whitespace')
        }

        webpush.setVapidDetails(
            'mailto:notifications@sladeshultimate.app',
            publicKey,
            privateKey
        )
        vapidConfigured = true
    }
}

async function readBody(req) {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks).toString('utf8')
    if (!raw) return {}
    try {
        return JSON.parse(raw)
    } catch (error) {
        throw new Error('Invalid JSON body')
    }
}

async function verifyAdminToken(req) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.split('Bearer ')[1]
    try {
        const decodedToken = await admin.auth().verifyIdToken(token)
        return decodedToken
    } catch (error) {
        console.error('[adminBroadcast] Token verification failed', error)
        return null
    }
}

function isAdminUser(email) {
    return email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase()
}

function isUnrecoverablePushError(error) {
    const statusCode = error?.statusCode || error?.status
    return statusCode === 404 || statusCode === 410 || statusCode === 401
}

module.exports = async (req, res) => {
    setCors(req, res)

    if (req.method === 'OPTIONS') {
        res.status(204).end()
        return
    }

    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method Not Allowed' })
        return
    }

    try {
        ensureEnv()
    } catch (error) {
        console.error('[adminBroadcast] Missing env vars', error)
        return res.status(500).json({ ok: false, error: error.message })
    }

    // Verify admin authentication
    const decodedToken = await verifyAdminToken(req)
    if (!decodedToken || !isAdminUser(decodedToken.email)) {
        console.warn('[adminBroadcast] Unauthorized access attempt', {
            email: decodedToken?.email || 'unknown'
        })
        return res.status(403).json({ ok: false, error: 'Unauthorized - Admin access required' })
    }

    try {
        const body = await readBody(req)
        const { channelId, title, message } = body

        // Validate input
        if (!channelId || !title || !message) {
            return res.status(400).json({
                ok: false,
                error: 'Missing required fields: channelId, title, message'
            })
        }

        console.log('[adminBroadcast] Processing broadcast', {
            channelId,
            title,
            adminEmail: decodedToken.email
        })

        // Get channel info
        const channelDoc = await db.collection('channels').doc(channelId).get()
        if (!channelDoc.exists) {
            return res.status(404).json({ ok: false, error: 'Channel not found' })
        }
        const channelName = channelDoc.data().name || 'din kanal'

        // Get all users in the channel
        const usersSnapshot = await db
            .collection('users')
            .where('joinedChannelIds', 'array-contains', channelId)
            .get()

        if (usersSnapshot.empty) {
            console.log('[adminBroadcast] No users in channel', { channelId })
            return res.status(200).json({
                ok: true,
                sent: 0,
                failed: 0,
                cleaned: 0,
                message: 'No users in channel'
            })
        }

        console.log('[adminBroadcast] Found users in channel', {
            channelId,
            userCount: usersSnapshot.size
        })

        // Build notification payload
        const payload = buildNotificationPayload('stress_signal', {
            title,
            body: message,
            channelId,
            channelName,
            data: {
                url: `/home?channel=${channelId}`
            }
        })

        let sent = 0
        let failed = 0
        let cleaned = 0

        // Send to all users in the channel
        for (const userDoc of usersSnapshot.docs) {
            const userId = userDoc.id

            // Get user's push subscriptions
            const subsSnapshot = await userDoc.ref.collection('pushSubscriptions').get()

            if (subsSnapshot.empty) {
                continue
            }

            // Send to each subscription
            for (const subDoc of subsSnapshot.docs) {
                const subscription = {
                    endpoint: subDoc.get('endpoint'),
                    keys: subDoc.get('keys')
                }

                if (!subscription.endpoint || !subscription.keys) {
                    // Invalid subscription, clean it up
                    await subDoc.ref.delete().catch(() => { })
                    cleaned++
                    continue
                }

                try {
                    await webpush.sendNotification(subscription, JSON.stringify(payload))
                    sent++

                    // Update last used timestamp
                    await subDoc.ref.update({
                        lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
                    }).catch(() => { })
                } catch (error) {
                    console.error('[adminBroadcast] Push send error', {
                        userId,
                        subscriptionId: subDoc.id,
                        error: error.message,
                        statusCode: error.statusCode
                    })

                    failed++

                    // Clean up dead subscriptions
                    if (isUnrecoverablePushError(error)) {
                        await subDoc.ref.delete().catch(() => { })
                        cleaned++
                    }
                }
            }
        }

        console.log('[adminBroadcast] Broadcast completed', {
            channelId,
            sent,
            failed,
            cleaned,
            totalUsers: usersSnapshot.size
        })

        res.status(200).json({
            ok: true,
            sent,
            failed,
            cleaned,
            message: `Broadcast sent to ${sent} subscriptions`
        })
    } catch (error) {
        console.error('[adminBroadcast] Handler error', error)
        res.status(500).json({ ok: false, error: error.message || 'Internal Server Error' })
    }
}
