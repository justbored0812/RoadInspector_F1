import { useEffect, useState } from 'react';

export default function OpeningSplash() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  return (
    <div className="opening-splash" aria-label="Loading Road Inspector">
      <div className="splash-orbit orbit-one" />
      <div className="splash-orbit orbit-two" />
      <div className="splash-mark">R</div>
      <div className="splash-kicker">NIRMAAN SYSTEMS</div>
      <div className="splash-title">ROAD INSPECTOR</div>
      <div className="splash-loading"><span /><span /><span /></div>
    </div>
  );
}
