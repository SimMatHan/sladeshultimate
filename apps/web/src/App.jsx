import { useState } from 'react';
import { enablePushAndSendTest } from './push';

export default function App() {
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    try {
      setBusy(true);
      await enablePushAndSendTest();
    } catch (e) {
      console.error(e);
      alert('Der opstod en fejl. Se konsollen.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'grid', placeItems: 'center',
      background: 'linear-gradient(135deg,#0ea5e9,#111827)', color: 'white'
    }}>
      <button
        onClick={onClick}
        disabled={busy}
        style={{
          fontSize: 18, padding: '14px 20px', borderRadius: 12,
          border: 'none', cursor: 'pointer', boxShadow: '0 10px 25px rgba(0,0,0,.25)'
        }}
      >
        {busy ? 'Arbejder…' : 'Aktivér push & send test'}
      </button>
    </div>
  );
}