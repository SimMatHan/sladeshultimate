const MOCK_CHANNEL_KEYS = {
  OPEN: 'open',
  BALLADE: 'ballade',
}

function normalizeName(name) {
  return (name || '').trim().toLowerCase()
}

export function resolveMockChannelKey(selectedChannel) {
  if (!selectedChannel) {
    return MOCK_CHANNEL_KEYS.OPEN
  }

  const channelName = normalizeName(selectedChannel.name)

  if (channelName === 'ballade') {
    return MOCK_CHANNEL_KEYS.BALLADE
  }

  if (selectedChannel.isDefault || channelName === 'den åbne kanal') {
    return MOCK_CHANNEL_KEYS.OPEN
  }

  return MOCK_CHANNEL_KEYS.BALLADE
}

export function isMemberOfMockChannel(entryChannels = [MOCK_CHANNEL_KEYS.OPEN], targetKey) {
  return entryChannels.includes(targetKey)
}

export { MOCK_CHANNEL_KEYS }

