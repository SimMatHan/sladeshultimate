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

function setCors(req, res) {
    const origin = req.headers.origin || ''
    const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
    res.setHeader('Access-Control-Allow-Origin', allow)
    res.setHeader('Vary', 'Origin')
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
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

async function verifyAuthToken(req) {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return null
    }

    const token = authHeader.split('Bearer ')[1]
    try {
        const decodedToken = await admin.auth().verifyIdToken(token)
        return decodedToken
    } catch (error) {
        console.error('[createBeacon] Token verification failed', error)
        return null
    }
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

    // Verify authentication
    const decodedToken = await verifyAuthToken(req)
    if (!decodedToken) {
        return res.status(401).json({ ok: false, error: 'Unauthorized - Authentication required' })
    }

    try {
        const body = await readBody(req)
        const { latitude, longitude, userName } = body
        const userId = decodedToken.uid

        // Validate input
        if (typeof latitude !== 'number' || typeof longitude !== 'number') {
            return res.status(400).json({
                ok: false,
                error: 'Invalid coordinates: latitude and longitude must be numbers'
            })
        }

        // Validate coordinate ranges
        if (latitude < -90 || latitude > 90) {
            return res.status(400).json({
                ok: false,
                error: 'Invalid latitude: must be between -90 and 90'
            })
        }

        if (longitude < -180 || longitude > 180) {
            return res.status(400).json({
                ok: false,
                error: 'Invalid longitude: must be between -180 and 180'
            })
        }

        console.log('[createBeacon] Creating beacon', {
            userId,
            latitude,
            longitude,
            userName
        })

        const now = admin.firestore.Timestamp.now()
        const expiresAt = admin.firestore.Timestamp.fromMillis(
            now.toMillis() + 2 * 60 * 60 * 1000 // 2 hours from now
        )

        // Create beacon document
        const beaconRef = await db.collection('stressBeacons').add({
            createdBy: userId,
            creatorName: userName || decodedToken.name || decodedToken.email || 'En bruger',
            latitude,
            longitude,
            createdAt: now,
            expiresAt,
            active: true,
            notificationsSent: 0,
            lastNotificationAt: null
        })

        console.log('[createBeacon] Beacon created successfully', {
            beaconId: beaconRef.id,
            userId,
            expiresAt: expiresAt.toDate().toISOString()
        })

        res.status(200).json({
            ok: true,
            beaconId: beaconRef.id,
            expiresAt: expiresAt.toMillis(),
            message: 'Stress Beacon created successfully'
        })
    } catch (error) {
        console.error('[createBeacon] Handler error', error)
        res.status(500).json({ ok: false, error: error.message || 'Internal Server Error' })
    }
}
