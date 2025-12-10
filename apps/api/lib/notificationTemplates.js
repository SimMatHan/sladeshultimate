const DEFAULT_TITLE = 'SladeshUltimate'

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
    const channelName = context.channelName || context.data?.channelName || 'en kanal'
    const senderName = context.senderName || context.data?.senderName || 'En ven'
    const preview = context.preview || context.data?.preview || context.message || ''
    const channelId = context.channelId || context.data?.channelId

    return {
      title: context.title || `Ny besked i ${channelName}`,
      body: context.body || `${senderName}: ${preview}`.trim(),
      tag: context.tag || (channelId ? `channel_${channelId}` : 'new_message'),
      data: {
        type: 'new_message',
        channelId,
        messageId: context.messageId || context.data?.messageId,
        url: context.data?.url || `/home?channel=${channelId || ''}`,
        ...context.data
      }
    }
  },
  check_in: (context = {}) => {
    const channelName = context.channelName || context.data?.channelName || 'din kanal'
    const userName = context.userName || context.data?.userName || 'En ven'
    const channelId = context.channelId || context.data?.channelId
    return {
      title: context.title || `${userName} er checket ind`,
      body: context.body || `Kom forbi ${channelName}`,
      tag: context.tag || (channelId ? `checkin_${channelId}` : 'check_in'),
      data: {
        type: 'check_in',
        channelId,
        channelName,
        userId: context.userId || context.data?.userId,
        userName,
        url: context.data?.url || `/home?channel=${channelId || ''}`,
        ...context.data
      }
    }
  },
  drink_milestone: (context = {}) => {
    const milestone = context.milestone || context.data?.milestone || 0
    const channelId = context.channelId || context.data?.channelId
    const channelName = context.channelName || context.data?.channelName || 'din kanal'
    const userName = context.userName || context.data?.userName || 'En ven'
    return {
      title: context.title || `${userName} ramte ${milestone} drinks`,
      body: context.body || `Hold festen kørende i ${channelName}`,
      tag: context.tag || `milestone_${milestone}_${channelId || 'solo'}`,
      data: {
        type: 'drink_milestone',
        milestone,
        channelId,
        channelName,
        userId: context.userId || context.data?.userId,
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
    title: context.title || 'Ny Sladesh!',
    body: context.body || `${senderName} har sendt dig en Sladesh 🍻`,
    tag: context.tag || `sladesh_${sladeshId || 'challenge'}`,
    data: {
      type: 'sladesh_received',
      senderId: context.senderId || context.data?.senderId,
      senderName,
      receiverId: context.receiverId || context.data?.receiverId,
      receiverName: context.receiverName || context.data?.receiverName,
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
  const outcomeRaw = (context.outcome || context.data?.outcome || 'completed').toString().toLowerCase()
  const isFailed = outcomeRaw === 'failed'
  const resolvedOutcome = isFailed ? 'failed' : 'completed'
  const resolvedTitle = isFailed
    ? `${receiverName} har fejlet sin Sladesh 😅`
    : `${receiverName} har gennemført sin Sladesh 🎉`
  const resolvedBody = isFailed
    ? 'De næste runde må vente lidt endnu.'
    : 'Din Sladesh er i hus. Send en ny, når du er klar!'
  return {
    title: context.title || resolvedTitle,
    body: context.body || resolvedBody,
    tag: context.tag || `sladesh_completed_${sladeshId || 'challenge'}`,
    data: {
      type: 'sladesh_completed',
      receiverId: context.receiverId || context.data?.receiverId,
      receiverName,
      outcome: resolvedOutcome,
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
    title: context.title || DEFAULT_TITLE,
    body: context.body || 'Ny aktivitet i Sladesh',
    tag: context.tag || 'sladesh_generic',
    data: {
      type: context.data?.type || 'generic',
      url: context.data?.url || '/',
      ...context.data
    }
  }
}

/**
 * Build a structured notification payload for web-push.
 * @param {string} type
 * @param {object} context
 * @returns {{title: string, body: string, tag: string, data: object}}
 */
function buildNotificationPayload(type = 'test', context = {}) {
  const builder = builders[type] || fallbackBuilder
  const base = builder(context)
  return {
    title: context.title || base.title || DEFAULT_TITLE,
    body: context.body || base.body || 'Ny aktivitet',
    tag: context.tag || base.tag || 'sladesh_generic',
    data: {
      ...base.data,
      ...(context.data || {})
    }
  }
}

module.exports = {
  buildNotificationPayload
}
