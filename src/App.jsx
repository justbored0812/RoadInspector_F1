import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { FiUploadCloud, FiAlertTriangle, FiCpu, FiMail, FiVideo, FiVideoOff, FiCamera, FiDatabase } from 'react-icons/fi';
import * as tmImage from '@teachablemachine/image';
import '@tensorflow/tfjs';
import exifr from 'exifr';
import Login from './Login';
import DatabaseView from './DatabaseView';
import { saveCrack, sendAlert as sendAlertRequest } from './api';

const MODEL_URL = 'https://teachablemachine.withgoogle.com/models/JILKj4N_4/';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showDatabase, setShowDatabase] = useState(false);
  const [model, setModel] = useState(null);
  const [isLoadingModel, setIsLoadingModel] = useState(true);
  const [results, setResults] = useState([]);
  const [alertSent, setAlertSent] = useState(false);
  const [targetEmail, setTargetEmail] = useState('');
  const [deviceGps, setDeviceGps] = useState(null);
  const [gpsStatus, setGpsStatus] = useState('Requesting...');

  // Webcam state
  const [webcamActive, setWebcamActive] = useState(false);
  const [livePrediction, setLivePrediction] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const animFrameRef = useRef(null);
  const alertSentRef = useRef(false);

  useEffect(() => {
    async function loadModel() {
      try {
        const t = Date.now();
        const loaded = await tmImage.load(
          `${MODEL_URL}model.json?t=${t}`,
          `${MODEL_URL}metadata.json?t=${t}`
        );
        setModel(loaded);
        setIsLoadingModel(false);
      } catch (err) {
        console.error('Failed to load model', err);
        setIsLoadingModel(false);
      }
    }
    loadModel();
  }, []);

  useEffect(() => {
    if (currentUser?.email) {
      setTargetEmail(currentUser.email);
    }
  }, [currentUser]);

  // ── Browser Geolocation ──
  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsStatus('Not supported');
      return;
    }
    setGpsStatus('Requesting...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setDeviceGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsStatus('Acquired');
      },
      (err) => {
        if (err.code === 1) setGpsStatus('Permission Denied');
        else if (err.code === 2) setGpsStatus('Unavailable');
        else setGpsStatus('Timeout');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, []);

  useEffect(() => {
    requestLocation();
    if (!navigator.geolocation) return undefined;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        setDeviceGps({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGpsStatus('Acquired');
      },
      () => {},
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [requestLocation]);

  // ── Webcam logic ──
  const startWebcam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setWebcamActive(true); // render <video> first, then attach in useEffect
    } catch (err) {
      alert('Could not access camera. Please allow camera permissions and try again.');
      console.error(err);
    }
  };

  // Attach stream to video element AFTER it is rendered in the DOM
  useEffect(() => {
    if (webcamActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [webcamActive]);

  const stopWebcam = () => {
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setWebcamActive(false);
    setLivePrediction(null);
  };

  // Prediction loop on webcam frames
  useEffect(() => {
    if (!webcamActive || !model || !videoRef.current) return;

    const predictLoop = async () => {
      if (videoRef.current && videoRef.current.readyState === 4) {
        const prediction = await model.predict(videoRef.current);
        const top = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
        const isUnsafe = top.className === 'Road Deformations';
        const displayClass = top.className;

        setLivePrediction({ prediction, top, isUnsafe, displayClass });

        // Auto-alert on crack/deformation (once per session)
        if (isUnsafe && !alertSentRef.current && targetEmail) {
          alertSentRef.current = true;
          try {
            const response = await sendAlertRequest({
                message: 'An unsafe condition (crack or deformation) was detected via live webcam feed.',
                recipientEmail: targetEmail,
                gps: deviceGps || null,
                timestamp: new Date().toISOString(),
                confidence: top.probability * 100,
                topClass: displayClass
            });
            if (response.success) setAlertSent(true);
            else console.warn(response.message);
          } catch (e) { console.error(e); }
        }
      }
      animFrameRef.current = requestAnimationFrame(predictLoop);
    };

    animFrameRef.current = requestAnimationFrame(predictLoop);
    return () => { if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current); };
  }, [webcamActive, model, targetEmail]);

  const saveUnsafeToDB = async (unsafeObj) => {
    if (!unsafeObj.isUnsafe) return;
    try {
      const result = await saveCrack(unsafeObj);
      if (!result.success) console.error('Failed to save detection:', result);
    } catch (e) {
      console.error('DB save error', e);
    }
  };

  // Capture snapshot from webcam and add to history
  const captureSnapshot = () => {
    if (!videoRef.current || !livePrediction) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);
    const preview = canvas.toDataURL('image/jpeg');
    const newRes = {
      id: Math.random().toString(36).substr(2, 9),
      preview,
      predictions: livePrediction.prediction,
      topClass: livePrediction.displayClass,
      rawClass: livePrediction.top.className,
      isUnsafe: livePrediction.isUnsafe,
      timestamp: new Date().toISOString(),
      gps: deviceGps || null,
      confidence: livePrediction.top.probability * 100
    };
    setResults(prev => [newRes, ...prev]);
    saveUnsafeToDB(newRes);
  };

  // Cleanup on unmount
  useEffect(() => () => stopWebcam(), []);

  // ── Upload logic ──
  const sendAlert = useCallback(async (file, gpsData, timestamp, confidence, topClass) => {
    if (alertSent) return;
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onloadend = async () => {
      try {
        const result = await sendAlertRequest({
            message: 'An unsafe condition (crack or deformation) was detected in an uploaded image.',
            image: reader.result,
            recipientEmail: targetEmail,
            gps: gpsData,
            timestamp: timestamp,
            confidence: confidence,
            topClass: topClass
        });
        if (result.success) setAlertSent(true);
      } catch (e) { console.error('Failed to send alert email', e); }
    };
  }, [alertSent, targetEmail]);

  const fileToBase64 = (f) => new Promise(res => { const r = new FileReader(); r.onloadend = () => res(r.result); r.readAsDataURL(f); });

  const processImage = useCallback(async (file) => {
    // Try EXIF first, fall back to device GPS
    let gpsData = null;
    try { gpsData = await exifr.gps(file); } catch (_) {}
    if (!gpsData && deviceGps) gpsData = deviceGps;
    const base64Data = await fileToBase64(file);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Data;
      img.onload = async () => {
        if (!model) return;
        const prediction = await model.predict(img);
        const top = prediction.reduce((a, b) => a.probability > b.probability ? a : b);
        const isUnsafe = top.className === 'Road Deformations';
        const displayClass = top.className;
        
        const newRes = {
          id: Math.random().toString(36).substr(2, 9),
          preview: base64Data,
          predictions: prediction,
          topClass: displayClass,
          rawClass: top.className,
          isUnsafe,
          timestamp: new Date().toISOString(),
          gps: gpsData,
          confidence: top.probability * 100
        };
        
        if (isUnsafe) {
          sendAlert(file, gpsData, newRes.timestamp, newRes.confidence, newRes.topClass);
          saveUnsafeToDB(newRes);
        }
        resolve(newRes);
      };
    });
  }, [model, sendAlert, deviceGps]);

  const onDrop = useCallback(async (acceptedFiles) => {
    const newResults = await Promise.all(acceptedFiles.map(f => processImage(f)));
    setResults(prev => [...newResults, ...prev]);
  }, [processImage]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
  });

  if (!currentUser) {
    return <Login onLoginSuccess={setCurrentUser} />;
  }

  if (isLoadingModel) {
    return (
      <div className="loading-state">
        <FiCpu className="init-icon" />
        <div className="init-title">Initializing Systems</div>
        <div className="init-sub">Loading neural network model. Please stand by...</div>
      </div>
    );
  }

  const latest = results[0];
  const activePred = webcamActive ? livePrediction : null;
  const sidebarPred = activePred
    ? { topClass: activePred.displayClass, rawClass: activePred.top.className, isUnsafe: activePred.isUnsafe, predictions: activePred.prediction }
    : latest;

  const getConf = (res) =>
    res.predictions.find(p => p.className === res.rawClass).probability * 100;

  return (
    <div id="app">
      {showDatabase && <DatabaseView onClose={() => setShowDatabase(false)} model={model} officialEmail={currentUser.email} />}

      {/* ── Header ── */}
      <header id="header">
        <div className="brand">
          <div className="brand-logo">R</div>
          <div className="brand-text">
            <h1>ROAD INSPECTOR</h1>
            <p>REAL-TIME INFRASTRUCTURE MONITORING</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div id="sys-status">
            <div className="status-dot" />
            Monitoring Active
          </div>
          <div className="user-badge">
            <div className="user-info">
              <div className="user-name">{currentUser.email}</div>
              <div className="user-role">{currentUser.role}</div>
            </div>
            <button className="btn-logout" onClick={() => setCurrentUser(null)}>
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Feed ── */}
      <div id="feed">

        {alertSent && (
          <div className="alert-banner">
            <FiAlertTriangle size={20} style={{ flexShrink: 0 }} />
            <div><strong>Alert Sent!</strong> Email dispatched for detected unsafe condition.</div>
          </div>
        )}

        {/* Email Input */}
        <div className="email-input-container">
          <FiMail size={18} style={{ color: 'var(--blue)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <label className="email-label">Alert Email Destination</label>
            <input
              type="email"
              placeholder="engineer@city.gov"
              value={targetEmail}
              onChange={e => {
                setTargetEmail(e.target.value);
                setAlertSent(false);
                alertSentRef.current = false;
              }}
            />
          </div>
        </div>

        {/* Upload Dropzone */}
        <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
          <input {...getInputProps()} />
          <FiUploadCloud className="dropzone-icon" />
          <h3>{isDragActive ? 'Drop images here…' : 'Tap to upload or drag & drop'}</h3>
          <p>Upload road surfaces for automated deformation inspection.</p>
        </div>

        {/* Webcam Section */}
        <div className="webcam-section">
          <div className="webcam-header">
            <div className="webcam-title">
              <FiVideo size={16} style={{ color: 'var(--blue)' }} />
              <span>Live Camera Feed</span>
              {webcamActive && livePrediction && (
                <span className={`live-badge ${livePrediction.isUnsafe ? 'live-danger' : 'live-safe'}`}>
                  ● LIVE — {livePrediction.displayClass.toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {webcamActive && (
                <button className="btn-snapshot" onClick={captureSnapshot} title="Capture snapshot">
                  <FiCamera size={15} /> Snapshot
                </button>
              )}
              <button
                className={`btn-webcam ${webcamActive ? 'stop' : 'start'}`}
                onClick={webcamActive ? stopWebcam : startWebcam}
              >
                {webcamActive ? <><FiVideoOff size={15} /> Stop</> : <><FiVideo size={15} /> Start Camera</>}
              </button>
            </div>
          </div>

          {webcamActive && (
            <div className="webcam-wrap">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="webcam-video"
                style={{
                  border: `3px solid ${livePrediction?.isUnsafe ? 'var(--red)' : livePrediction ? 'var(--green)' : 'var(--border)'}`,
                  display: 'block',
                  width: '100%',
                  minHeight: '200px',
                  backgroundColor: '#000',
                }}
              />
              {livePrediction?.isUnsafe && (
                <div className="image-overlay">
                  <div className="overlay-label">
                    <div className="status-dot error" /> UNSAFE DETECTED
                  </div>
                  <div className="info-row">
                    <span className="ir-key">Confidence</span>
                    <span className="ir-val">{(livePrediction.top.probability * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {!webcamActive && (
            <div className="webcam-placeholder">
              <FiVideo size={32} style={{ color: 'var(--muted)', marginBottom: 8 }} />
              <span>Camera is off. Press Start Camera to begin live inspection.</span>
            </div>
          )}
        </div>

        {currentUser?.role === 'BMC Official' && (
          <button className="btn-database" onClick={() => setShowDatabase(true)}>
            <FiDatabase style={{ marginRight: '8px' }} />
            Road Deformation Database
          </button>
        )}

        {/* Latest uploaded image */}
        {latest && !webcamActive && (
          <div className="latest-image-wrap">
            <img
              src={latest.preview}
              alt="Latest Scan"
              style={{ border: `3px solid ${latest.isUnsafe ? 'var(--red)' : 'var(--green)'}` }}
            />
            {latest.isUnsafe && (
              <div className="image-overlay">
                <div className="overlay-label">
                  <div className="status-dot error" /> UNSAFE DETECTED
                </div>
                <div className="info-row">
                  <span className="ir-key">Confidence</span>
                  <span className="ir-val">{getConf(latest).toFixed(0)}%</span>
                </div>
                <div className="info-row">
                  <span className="ir-key">Detected</span>
                  <span className="ir-val">{latest.timestamp}</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Sidebar ── */}
      <div id="sidebar">

        {/* Live Prediction */}
        <div className="sidebar-section">
          <div className="sec-label">LIVE PREDICTION</div>
          {sidebarPred ? (
            <div className="pred-big" style={{ borderColor: sidebarPred.isUnsafe ? 'var(--red)' : 'var(--green)' }}>
              <div className={`pred-class ${sidebarPred.isUnsafe ? 'unsafe' : 'safe'}`}>
                {sidebarPred.topClass}
              </div>
              <div className="pred-conf">Confidence: {getConf(sidebarPred).toFixed(1)}%</div>
              <div className="conf-bar">
                <div
                  className={`conf-fill ${sidebarPred.isUnsafe ? 'unsafe' : ''}`}
                  style={{ width: `${getConf(sidebarPred)}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="pred-big">
              <div className="pred-class waiting">Waiting…</div>
            </div>
          )}

          {sidebarPred && (
            <div className="pred-rows">
              {sidebarPred.predictions.filter(p => !p.className.toLowerCase().includes('arnav')).map(p => {
                const isUnsafeClass = p.className === 'Road Deformations';
                const isMatch = p.className === sidebarPred.rawClass;
                return (
                  <div key={p.className} className="pred-row">
                    <div className="pred-row-header">
                      <span className="pr-label" style={{
                        color: isMatch ? (isUnsafeClass ? 'var(--red)' : 'var(--green)') : 'var(--muted)'
                      }}>
                        {p.className === 'All clear' ? 'All clear' : p.className}
                      </span>
                      <span className="pr-pct">{(p.probability * 100).toFixed(1)}%</span>
                    </div>
                    <div className="pr-bar">
                      <div className="pr-fill" style={{
                        width: `${p.probability * 100}%`,
                        background: isUnsafeClass ? 'var(--red)' : 'var(--blue)',
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Location */}
        <div className="sidebar-section">
          <div className="sec-label">LOCATION</div>
          <div className="info-row">
            <span className="ir-key">Latitude</span>
            <span className="ir-val">
              {latest?.gps ? latest.gps.latitude.toFixed(6) : deviceGps ? deviceGps.latitude.toFixed(6) : '—'}
            </span>
          </div>
          <div className="info-row">
            <span className="ir-key">Longitude</span>
            <span className="ir-val">
              {latest?.gps ? latest.gps.longitude.toFixed(6) : deviceGps ? deviceGps.longitude.toFixed(6) : '—'}
            </span>
          </div>
          {deviceGps?.accuracy && (
            <div className="info-row">
              <span className="ir-key">Accuracy</span>
              <span className="ir-val">{deviceGps.accuracy.toFixed(0)} m</span>
            </div>
          )}
          <div className="info-row">
            <span className="ir-key">GPS Status</span>
            <span className="ir-val" style={{ color: gpsStatus === 'Acquired' ? 'var(--green)' : gpsStatus === 'Requesting...' ? 'var(--orange)' : 'var(--red)' }}>
              {gpsStatus}
            </span>
          </div>
          {gpsStatus !== 'Acquired' && (
            <button className="btn-secondary location-permission-button" onClick={requestLocation}>
              Allow Location Access
            </button>
          )}
        </div>
      </div>

      {/* ── History ── */}
      <div id="history">
        <div className="hist-header">
          <div className="hist-title">DETECTION HISTORY — THIS SESSION</div>
          <div id="hist-count">{results.length} events</div>
        </div>
        <div id="hist-list">
          {results.map(res => (
            <div key={res.id} className="hist-row">
              <div className={`badge ${res.isUnsafe ? 'badge-danger' : 'badge-success'}`}>
                {res.isUnsafe ? res.displayClass?.toUpperCase() || 'UNSAFE' : 'SAFE'}
              </div>
              <div style={{ color: 'var(--muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {res.id}
              </div>
              <div style={{ color: res.isUnsafe ? 'var(--red)' : 'var(--green)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                {getConf(res).toFixed(0)}%
              </div>
              <div style={{ color: 'var(--muted)', whiteSpace: 'nowrap' }}>{res.timestamp}</div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}

export default App;
