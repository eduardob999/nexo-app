import { useEffect, useState } from 'react';
import { ALARM_PATTERNS, enablePush, loadPattern, pushState, savePattern, testAlarm, testPush, type AlarmPattern, type PushState } from './push';

const WORDS: Record<PushState, string> = {
  unsupported: 'This browser cannot receive notifications. Install the app on the home screen first.',
  blocked: 'Blocked in the phone settings. Allow notifications for Nexo there, then come back.',
  off: 'Off',
  on: 'On for this phone',
};

export function Notifications({ uid }: { uid: string }) {
  const [state, setState] = useState<PushState>('off');
  const [busy, setBusy] = useState('');
  const [pattern, setPattern] = useState<AlarmPattern>(loadPattern());
  const [testing, setTesting] = useState(false);
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
        {state === 'on' ? (
          <>
            <div className="setting"><span>Wake-up buzz</span>
              <div className="seg" role="group" aria-label="Wake-up buzz">
                {ALARM_PATTERNS.map((p) => (
                  <button key={p.id} aria-pressed={pattern === p.id} onClick={() => { setPattern(p.id); savePattern(p.id); }}>{p.label}</button>
                ))}
              </div>
            </div>
            <div className="setting"><span>Test the wake-up alarm</span>
              <button className="chip-btn small" disabled={testing} onClick={() => { setTesting(true); void testAlarm(pattern).finally(() => setTimeout(() => setTesting(false), 7000)); }}>{testing ? 'Coming in 6 s' : 'Trigger in 6 s'}</button>
            </div>
            <p className="mut">Lock the phone after pressing Trigger. The sound is the one Android uses for Nexo notifications: press and hold the test notification, open its settings, and choose Sound and importance there. A web app cannot pick a ringtone itself.</p>
          </>
        ) : null}
        <p className="mut">Questions, answers, urgent cards, assignments due soon, and when Nexo stops working. Quiet between 23:00 and 07:00.</p>
      </div>
    </>
  );
}
