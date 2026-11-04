import { useEffect, useState } from 'react';
import { enablePush, pushState, testPush, type PushState } from './push';

const WORDS: Record<PushState, string> = {
  unsupported: 'This browser cannot receive notifications. Install the app on the home screen first.',
  blocked: 'Blocked in the phone settings. Allow notifications for Nexo there, then come back.',
  off: 'Off',
  on: 'On for this phone',
};

export function Notifications({ uid }: { uid: string }) {
  const [state, setState] = useState<PushState>('off');
  const [busy, setBusy] = useState('');
  useEffect(() => { void pushState().then(setState); }, []);
  const turnOn = () => {
    setBusy('Turning on');
    enablePush(uid).then((s) => { setState(s); setBusy(''); if (s === 'on') void testPush(); }, (e: unknown) => setBusy(e instanceof Error ? e.message : 'Could not turn on'));
  };
  return (
    <>
      <h2 className="group-title">Notifications</h2>
      <div className="panel settings">
        <div className="setting"><span>Push from Nexo</span>
          {state === 'on' ? <button className="chip-btn small" onClick={() => { void testPush(); }}>Send a test</button>
            : state === 'off' ? <button className="chip-btn small" onClick={turnOn}>Turn on</button> : null}
        </div>
        <p className="mut" role="status">{busy || WORDS[state]}</p>
        <p className="mut">Questions, answers, urgent cards, assignments due soon, and when Nexo stops working. Quiet between 23:00 and 07:00.</p>
      </div>
    </>
  );
}
