const configuredApiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const localStorageKey = 'nirmaan_crack_records';

// In development the Vite proxy reaches the local Express server. GitHub Pages
// has no Node runtime, so production works offline unless VITE_API_URL is set.
const useRemoteApi = Boolean(configuredApiUrl) || import.meta.env.DEV;
const endpoint = (path) => `${configuredApiUrl}${path}`;

const readLocalRecords = () => {
  try {
    return JSON.parse(localStorage.getItem(localStorageKey) || '[]');
  } catch {
    return [];
  }
};

const writeLocalRecords = (records) => {
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(records));
    return true;
  } catch (error) {
    console.error('Could not write local records (storage full?)', error);
    return false;
  }
};

export async function getCracks() {
  if (useRemoteApi) {
    try {
      const response = await fetch(endpoint('/api/get-cracks'));
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    } catch (error) {
      if (import.meta.env.DEV || configuredApiUrl) console.warn('Using local detection storage:', error);
    }
  }
  return { success: true, data: readLocalRecords(), local: true };
}

export async function saveCrack(detection) {
  if (!detection.isUnsafe && !detection.isCrack) {
    return { success: true, message: 'Not a crack, skipped.' };
  }

  if (useRemoteApi) {
    try {
      const response = await fetch(endpoint('/api/save-crack'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(detection),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    } catch (error) {
      if (import.meta.env.DEV || configuredApiUrl) console.warn('Saving detection locally:', error);
    }
  }

  const record = {
    ...detection,
    id: detection.id || crypto.randomUUID(),
    status: detection.status || 'open',
    isCrack: detection.isCrack ?? detection.isUnsafe,
    timestamp: detection.timestamp || new Date().toISOString(),
  };
  writeLocalRecords([record, ...readLocalRecords()]);
  return { success: true, data: record, local: true };
}

export async function sendAlert(payload) {
  if (!useRemoteApi) {
    return { success: false, message: 'Email alerts require a deployed backend.' };
  }

  const response = await fetch(endpoint('/api/send-alert'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`Alert request failed: ${response.status}`);
  return response.json();
}

// Mark ONE record as fixed. Called only after the verification photo has passed
// the AI check, so `proof` holds the "after" picture taken by the BMC official.
export async function markFixed(id, proof) {
  const patch = {
    status: 'fixed',
    fixedAt: new Date().toISOString(),
    fixedBy: proof.fixedBy || null,
    fixedPreview: proof.fixedPreview || null,
    fixedConfidence: proof.fixedConfidence ?? null,
  };

  if (useRemoteApi) {
    try {
      const response = await fetch(endpoint('/api/mark-fixed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return response.json();
    } catch (error) {
      if (import.meta.env.DEV || configuredApiUrl) console.warn('Marking fixed locally:', error);
    }
  }

  const records = readLocalRecords();
  if (!records.some((r) => r.id === id)) return { success: false, message: 'Record not found.' };
  const ok = writeLocalRecords(records.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  return ok
    ? { success: true, local: true }
    : { success: false, message: 'Browser storage is full. Clear old records and try again.' };
}
