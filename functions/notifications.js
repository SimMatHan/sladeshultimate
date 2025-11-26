const functions = require('firebase-functions')
const webpush = require('web-push')

let configured = false

const builders = {
  test: (context = {}) => ({
    title: context.title || 'Sladesh test',
    body: context.body || 'Det virker! 🎉',
    tag: context.tag || 'test',
    data: {
      type: 'test',
      url: context.data?.url || '/',
      ...context.data
    }
  }),
  new_message: (context = {}) => {
    const channelName = context.channelName || 'din kanal'
    const senderName = context.senderName || 'En ven'
    const preview = context.preview || ''
    const channelId = context.channelId
    return {
      title: context.title || `Ny besked i ${channelName}`,
      body: context.body || `${senderName}: ${preview}`.trim(),
      tag: context.tag || (channelId ? `channel_${channelId}` : 'new_message'),
      data: {
        type: 'new_message',
        channelId,
        messageId: context.messageId,
        url: context.data?.url || `/home?channel=${channelId || ''}`,
        ...context.data
      }
    }
  }
}

function fallbackBuilder(context = {}) {
  return {
    title: context.title || 'SladeshUltimate',
    body: context.body || 'Ny aktivitet i Sladesh',
    tag: context.tag || 'sladesh_generic',
    data: {
      type: context.data?.type || 'generic',
      url: context.data?.url || '/',
      ...context.data
    }
  }
}

function ensureConfigured() {
  if (configured) return
  const env = {
    public: process.env.VAPID_PUBLIC_KEY || functions.config()?.vapid?.public,
    private: process.env.VAPID_PRIVATE_KEY || functions.config()?.vapid?.private
  }
  if (!env.public || !env.private) {
    throw new Error('Missing VAPID keys. Set VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY env or firebase functions config.')
  }

  webpush.setVapidDetails('mailto:notifications@sladeshultimate.app', env.public, env.private)
  configured = true
}

function buildNotificationPayload(type = 'test', context = {}) {
  const builder = builders[type] || fallbackBuilder
  const base = builder(context)
  return {
    title: context.title || base.title,
    body: context.body || base.body,
    tag: context.tag || base.tag,
    data: {
      ...base.data,
      ...(context.data || {})
    }
  }
}

async function sendWebPush(subscription, payload) {
  ensureConfigured()
  return webpush.sendNotification(subscription, JSON.stringify(payload))
}

function isUnrecoverablePushError(error) {
  return [404, 410, 401].includes(error?.statusCode)
}

module.exports = {
  buildNotificationPayload,
  sendWebPush,
  isUnrecoverablePushError
}

