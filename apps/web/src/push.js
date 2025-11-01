const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;
const API_BASE = import.meta.env.VITE_API_BASE;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export async function enablePushAndSendTest() {
  if (!('serviceWorker' in navigator)) {
    alert('Service workers ikke understøttet i denne browser.');
    return;
  }
  if (!('PushManager' in window)) {
    alert('Push API ikke understøttet i denne browser.');
    return;
  }

  // 1) Registrér SW
  const reg = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  // 2) Permission
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    alert('Notifikations-tilladelse afvist.');
    return;
  }

  // 3) Subscribe
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
  });

  // 4) Gem lokalt (midlertidigt)
  localStorage.setItem('sladeshpro_subscription', JSON.stringify(sub));

  // 5) Kald Vercel API for at sende en test-notifikation
  const res = await fetch(`${API_BASE}/api/sendPush`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Det virker i baggrunden! 🎉',
      subscription: sub,
      url: '/'
    })
  });

  if (res.ok) {
    alert('Push sendt! Tjek din notifikationsbakke.');
  } else {
    const t = await res.text();
    alert('Fejl fra API: ' + t);
  }
}