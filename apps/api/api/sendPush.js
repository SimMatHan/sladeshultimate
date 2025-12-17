const webpush = require('web-push')
const { buildNotificationPayload } = require('../lib/notificationTemplates')

// Allow localhost and hosted origins. Keep in sync with frontend fetches.
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://sladeshultimate-1.web.app',
  'https://sladeshultimate-1.firebaseapp.com'
]

const REQUIRED_ENVS = ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY']
let vapidConfigured = false

function setCors(req, res) {
  const origin = req.headers.origin || ''
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  res.setHeader('Access-Control-Allow-Origin', allow)
  res.setHeader('Vary', 'Origin')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
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
    console.error('[sendPush] Missing env vars', error)
    return res.status(500).json({ ok: false, error: error.message })
  }

  try {
    const body = await readBody(req)
    const subscription = body.subscription

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ ok: false, error: 'subscription missing or invalid' })
    }

    const notificationPayload = buildNotificationPayload(body.type || 'test', {
      title: body.title,
      body: body.body || body.message,
      tag: body.tag,
      data: body.data,
      channelId: body.channelId,
      channelName: body.channelName,
      senderName: body.senderName,
      preview: body.preview,
      messageId: body.messageId
    })

    try {
      await webpush.sendNotification(subscription, JSON.stringify(notificationPayload))
    } catch (error) {
      console.error('[sendPush] web-push error', error)
      if (error.statusCode) {
        return res.status(error.statusCode).json({
          ok: false,
          error: error.body || error.message
        })
      }
      throw error
    }

    res.status(200).json({
      ok: true,
      payload: notificationPayload
    })
  } catch (error) {
    console.error('[sendPush] Handler error', error)
    res.status(500).json({ ok: false, error: error.message || 'Internal Server Error' })
  }
}
