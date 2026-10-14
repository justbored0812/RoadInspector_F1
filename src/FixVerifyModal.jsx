import { useCallback, useEffect, useRef, useState } from 'react';
import { FiX, FiCamera, FiAlertTriangle, FiRefreshCw, FiUpload } from 'react-icons/fi';
import { markFixed } from './api';

const UNSAFE_CLASS = 'Road Deformations';
const MAX_W = 640; // keep the stored "after" photo small

// Opens the camera, takes an "after" picture, runs the same Teachable Machine
// model used for detection, and only marks THIS record as fixed if the model
// no longer sees a road deformation.
function FixVerifyModal({ crack, model, officialEmail, onClose, onFixed }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileRef = useRef(null);
  const [phase, setPhase] = useState('camera'); // camera | checking | rejected | error
  const [camError, setCamError] = useState('');
  const [shot, setShot] = useState(null);
  const [verdict, setVerdict] = useState(null);

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  // Attach the stream whenever the <video> element (re)mounts, e.g. after "Retake"
  const setVideoEl = useCallback((el) => {
    videoRef.current = el;
    if (el && streamRef.current) {
      el.srcObject = streamRef.current;
      el.play().catch(console.error);
    }
  }, []);

  const openStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(console.error);
      }
    } catch (err) {
      console.error(err);
      setCamError('Camera unavailable. Allow camera permission, or upload a photo instead.');
    }
  };

  const retake = () => {
    setCamError('');
    setShot(null);
    setVerdict(null);
    setPhase('camera');
    openStream();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    openStream();
    return stopStream;
  }, []);

  const verify = async (source, w, h) => {
    const scale = Math.min(1, MAX_W / w);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.75);
    setShot(dataUrl);
    stopStream();

    if (!model) {
      setPhase('error');
      setVerdict({ message: 'AI model is not loaded, so the repair cannot be verified.' });
      return;
    }

    setPhase('checking');
    try {
      const prediction = await model.predict(canvas);
      const top = prediction.reduce((a, b) => (a.probability > b.probability ? a : b));
      if (top.className === UNSAFE_CLASS) {
        setVerdict({ top, message: `AI still detects a road deformation (${(top.probability * 100).toFixed(0)}% confidence).` });
        setPhase('rejected');
        return;
      }
      const result = await markFixed(crack.id, {
        fixedBy: officialEmail,
        fixedPreview: dataUrl,
        fixedConfidence: top.probability * 100,
      });
      if (!result.success) {
        setVerdict({ message: result.message || 'Could not save the update.' });
        setPhase('error');
        return;
      }
      onFixed();
    } catch (err) {
      console.error(err);
      setVerdict({ message: 'Verification failed. Please try again.' });
      setPhase('error');
    }
  };

  const capture = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth) return;
    verify(v, v.videoWidth, v.videoHeight);
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => verify(img, img.naturalWidth, img.naturalHeight);
    img.src = URL.createObjectURL(file);
    e.target.value = '';
  };

  const close = () => {
    stopStream();
    onClose();
  };

  return (
    <div className="fix-overlay">
      <div className="fix-modal">
        <div className="fix-header">
          <div>
            <h3>Confirm repair</h3>
            <p>Take a photo of the repaired spot. The AI must see no deformation.</p>
          </div>
          <button className="db-close" onClick={close}><FiX size={22} /></button>
        </div>

        <div className="fix-compare">
          <div>
            <span className="fix-tag">Reported</span>
            <img src={crack.preview} alt="Reported deformation" />
          </div>
          <div>
            <span className="fix-tag">After repair</span>
            {shot ? (
              <img src={shot} alt="After repair" />
            ) : (
              <video ref={setVideoEl} autoPlay playsInline muted className="fix-video" />
            )}
          </div>
        </div>

        {camError && phase === 'camera' && <div className="fix-note fix-warn"><FiAlertTriangle /> {camError}</div>}
        {phase === 'checking' && <div className="fix-note"><FiRefreshCw className="fix-spin" /> Checking with AI…</div>}
        {phase === 'rejected' && <div className="fix-note fix-bad"><FiAlertTriangle /> {verdict.message} Not marked as fixed.</div>}
        {phase === 'error' && <div className="fix-note fix-bad"><FiAlertTriangle /> {verdict?.message}</div>}

        <div className="fix-actions">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
          {phase === 'camera' && (
            <>
              <button className="btn-primary fix-btn" onClick={capture} disabled={!!camError}><FiCamera /> Capture &amp; verify</button>
              <button className="btn-secondary fix-btn" onClick={() => fileRef.current?.click()}><FiUpload /> Upload photo</button>
            </>
          )}
          {(phase === 'rejected' || phase === 'error') && (
            <button className="btn-primary fix-btn" onClick={retake}><FiRefreshCw /> Retake photo</button>
          )}
          <button className="btn-secondary fix-btn" onClick={close}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default FixVerifyModal;
