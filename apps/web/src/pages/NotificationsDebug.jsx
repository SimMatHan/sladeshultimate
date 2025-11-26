import { useCallback, useEffect, useMemo, useState } from 'react'
import Page from '../components/Page'
import Card from '../components/Card'
import { useAuth } from '../hooks/useAuth'
import {
  ensurePushSubscription,
  getCachedSubscription,
  getNotificationPermission,
  isPushSupported,
  requestBrowserPermission,
  resetPermissionPromptFlag,
  sendTestNotification
} from '../push'
import { listPushSubscriptions } from '../services/pushSubscriptionService'

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <span className="font-medium text-[color:var(--muted)]">{label}</span>
      <span className="text-right text-[color:var(--ink)]">{value}</span>
    </div>
  )
}

export default function NotificationsDebug() {
  const { currentUser } = useAuth()
  const [permission, setPermission] = useState(() => getNotificationPermission())
  const [localSubscription, setLocalSubscription] = useState(() => getCachedSubscription())
  const [remoteSubscriptions, setRemoteSubscriptions] = useState([])
  const [loadingRemote, setLoadingRemote] = useState(false)
  const [working, setWorking] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [error, setError] = useState(null)

  const subscriptionSummary = useMemo(() => {
    if (!localSubscription) return 'Ingen lokal subscription'
    const endpoint = localSubscription.endpoint || ''
    return `${endpoint.slice(0, 24)}…${endpoint.slice(-8)}`
  }, [localSubscription])

  const refreshRemoteSubscriptions = useCallback(async () => {
    if (!currentUser?.uid) {
      setRemoteSubscriptions([])
      return
    }
    try {
      setLoadingRemote(true)
      const subs = await listPushSubscriptions(currentUser.uid)
      setRemoteSubscriptions(subs)
    } catch (err) {
      console.error('[debug] Failed to load subscriptions', err)
      setError(err.message || 'Kunne ikke hente subscriptions')
    } finally {
      setLoadingRemote(false)
    }
  }, [currentUser])

  useEffect(() => {
    refreshRemoteSubscriptions()
  }, [refreshRemoteSubscriptions])

  const handleRequestPermission = useCallback(async () => {
    setError(null)
    const nextPermission = await requestBrowserPermission()
    setPermission(nextPermission)
    if (nextPermission !== 'granted') {
      setLastResult('Browser afviste eller afbrød forespørgslen.')
    } else {
      setLastResult('Tilladelse givet – fortsæt med at oprette abonnement.')
    }
  }, [])

  const handleRefreshSubscription = useCallback(async () => {
    if (!currentUser) {
      setError('Du skal være logget ind for at teste.')
      return
    }
    setWorking(true)
    setError(null)
    setLastResult(null)
    try {
      const result = await ensurePushSubscription({ currentUser, forceRefresh: true })
      if (!result.ok) {
        throw new Error(result.reason || 'Ukendt fejl under abonnement')
      }
      setLocalSubscription(result.subscription)
      await refreshRemoteSubscriptions()
      setLastResult('Abonnement gemt i Firestore og lokalt.')
    } catch (err) {
      console.error('[debug] Refresh subscription failed', err)
      setError(err.message || 'Kunne ikke oprette abonnement.')
    } finally {
      setWorking(false)
    }
  }, [currentUser, refreshRemoteSubscriptions])

  const handleSendTest = useCallback(async () => {
    setWorking(true)
    setError(null)
    setLastResult(null)
    try {
      const payload = await sendTestNotification()
      setLastResult(`Test sendt. Tag: ${payload.payload?.tag || payload.tag || 'ukendt'}`)
    } catch (err) {
      console.error('[debug] send test error', err)
      setError(err.message || 'Fejl ved testnotifikation')
    } finally {
      setWorking(false)
    }
  }, [])

  const handleResetPromptFlag = useCallback(() => {
    resetPermissionPromptFlag()
    setLastResult('Prompt-flag nulstillet. Re-indlæs siden for at se prompten igen.')
  }, [])

  return (
    <Page title="Notifikationer">
      <div className="space-y-6">
        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Status</h2>
          <InfoRow label="Push-understøttelse" value={isPushSupported() ? 'Ja' : 'Nej'} />
          <InfoRow label="Tilladelse" value={permission} />
          <InfoRow label="Lokal subscription" value={subscriptionSummary} />
          <InfoRow label="Remote subscriptions" value={remoteSubscriptions.length} />
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Handlinger</h2>
          <div className="grid gap-3">
            <button
              type="button"
              onClick={handleRequestPermission}
              className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[color:var(--ink)]"
            >
              Anmod om tilladelse igen
            </button>
            <button
              type="button"
              onClick={handleRefreshSubscription}
              disabled={working}
              className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[color:var(--ink)] disabled:opacity-50"
            >
              Opret/opdater subscription
            </button>
            <button
              type="button"
              onClick={handleSendTest}
              disabled={working}
              className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[color:var(--ink)] disabled:opacity-50"
            >
              Send testnotifikation
            </button>
            <button
              type="button"
              onClick={handleResetPromptFlag}
              className="rounded-2xl border border-dashed border-[var(--line)] px-4 py-3 text-sm text-[color:var(--muted)]"
            >
              Nulstil “vis prompt” flag
            </button>
            <button
              type="button"
              onClick={refreshRemoteSubscriptions}
              disabled={loadingRemote}
              className="rounded-2xl border border-[var(--line)] px-4 py-3 text-sm font-semibold text-[color:var(--ink)] disabled:opacity-50"
            >
              Opdater Firestore-liste
            </button>
          </div>
        </Card>

        <Card className="space-y-4 p-5">
          <h2 className="text-lg font-semibold text-[color:var(--ink)]">Firestore subscriptions</h2>
          {loadingRemote && <p className="text-sm text-[color:var(--muted)]">Indlæser…</p>}
          {!loadingRemote && remoteSubscriptions.length === 0 && (
            <p className="text-sm text-[color:var(--muted)]">Ingen subscriptions fundet.</p>
          )}
          <div className="space-y-3">
            {remoteSubscriptions.map((sub) => (
              <div key={sub.id} className="rounded-2xl border border-[var(--line)] px-4 py-3 text-left text-xs">
                <div className="font-semibold text-[color:var(--ink)]">{sub.id}</div>
                <div className="mt-1 text-[color:var(--muted)]">
                  {sub.endpoint?.slice(0, 32)}…{sub.endpoint?.slice(-8)}
                </div>
                <div className="mt-2 text-[color:var(--muted)]">
                  Opdateret: {sub.updatedAt?.toDate ? sub.updatedAt.toDate().toLocaleString() : '—'}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {(error || lastResult) && (
          <Card className="p-5">
            {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
            {lastResult && <p className="text-sm text-emerald-600">{lastResult}</p>}
          </Card>
        )}
      </div>
    </Page>
  )
}

