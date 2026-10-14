import { useEffect, useState } from 'react';
import './pwa.css';

const dismissedKey = 'road-inspector-install-dismissed';

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
const isIos = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

export default function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone() || sessionStorage.getItem(dismissedKey)) return;
    setIos(isIos());

    const onBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      setVisible(true);
    };
    const onInstalled = () => {
      setVisible(false);
      setInstallEvent(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if (isIos()) setVisible(true);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const dismiss = () => {
    sessionStorage.setItem(dismissedKey, 'true');
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="pwa-install-overlay" role="dialog" aria-modal="true" aria-label="Install Road Inspector">
      <div className="pwa-install-card">
        <div className="pwa-install-logo">R</div>
        <h2>Install Road Inspector</h2>
        <p>Install the app for faster access and an app-like full-screen experience.</p>
        {ios ? (
          <div className="pwa-ios-guide">
            <span>1. Tap the <strong>Share</strong> button in Safari.</span>
            <span>2. Choose <strong>Add to Home Screen</strong>.</span>
            <span>3. Tap <strong>Add</strong> to install.</span>
          </div>
        ) : (
          <button className="pwa-install-button" onClick={install} disabled={!installEvent}>
            Download App
          </button>
        )}
        <button className="pwa-later-button" onClick={dismiss}>Maybe later</button>
      </div>
    </div>
  );
}
