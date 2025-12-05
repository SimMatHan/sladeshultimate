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
  },
  check_in: (context = {}) => {
    const channelName = context.channelName || 'din kanal'
    const userName = context.userName || 'En ven'
    const channelId = context.channelId
    return {
      title: context.title || `${userName} er checket ind`,
      body: context.body || `Kom og si' hej i ${channelName}`,
      tag: context.tag || (channelId ? `checkin_${channelId}` : 'check_in'),
      data: {
        type: 'check_in',
        channelId,
        channelName,
        userId: context.userId,
        userName,
        url: context.data?.url || `/home?channel=${channelId || ''}`,
        ...context.data
      }
    }
  },
  drink_milestone: (context = {}) => {
    const milestone = context.milestone || context.data?.milestone || 0
    const channelId = context.channelId
    const userName = context.userName || 'En ven'
    const channelName = context.channelName || 'din kanal'
    return {
      title: context.title || `${userName} ramte ${milestone} drinks`,
      body: context.body || `Hold dampen oppe i ${channelName}`,
      tag: context.tag || `milestone_${milestone}_${channelId || 'solo'}`,
      data: {
        type: 'drink_milestone',
        milestone,
        channelId,
        channelName,
        userId: context.userId,
        url: context.data?.url || `/home?channel=${channelId || ''}`,
        ...context.data
      }
    }
  },
  usage_reminder: (context = {}) => {
    const channelId = context.channelId || context.data?.channelId
    return {
      title: context.title || 'Tid til en Sladesh-update?',
      body: context.body || 'Log næste drink eller check ind igen for holdet 🍹',
      tag: context.tag || 'usage_reminder',
      data: {
        type: 'usage_reminder',
        channelId,
        userId: context.userId || context.data?.userId,
        url: context.data?.url || `/home?channel=${channelId || ''}`,
        ...context.data
      }
    }
  },
  sladesh_received: (context = {}) => {
    const senderName = context.senderName || context.data?.senderName || 'En ven'
    const sladeshId = context.sladeshId || context.data?.sladeshId
    const channelId = context.channelId || context.data?.channelId
    return {
      title: context.title || `${senderName} har sendt dig en Sladesh!`,
      body: context.body || 'Åbn appen og gennemfør udfordringen 🍺',
      tag: context.tag || `sladesh_${sladeshId || 'challenge'}`,
      data: {
        type: 'sladesh_received',
        senderId: context.senderId || context.data?.senderId,
        senderName,
        sladeshId,
        channelId,
        url: context.data?.url || (channelId ? `/home?channel=${channelId}` : '/home'),
        ...context.data
      }
    }
  },
  sladesh_completed: (context = {}) => {
    const receiverName = context.receiverName || context.data?.receiverName || 'En ven'
    const sladeshId = context.sladeshId || context.data?.sladeshId
    const channelId = context.channelId || context.data?.channelId
    return {
      title: context.title || `${receiverName} fuldførte din Sladesh`,
      body: context.body || 'Klar til næste udfordring? 🚀',
      tag: context.tag || `sladesh_completed_${sladeshId || 'challenge'}`,
      data: {
        type: 'sladesh_completed',
        receiverId: context.receiverId || context.data?.receiverId,
        receiverName,
        sladeshId,
        channelId,
        url: context.data?.url || (channelId ? `/home?channel=${channelId}` : '/home'),
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
