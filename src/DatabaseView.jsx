import React, { useEffect, useState } from 'react';
import { FiX, FiDatabase, FiMapPin, FiClock, FiActivity, FiImage, FiAlertCircle, FiCheckSquare } from 'react-icons/fi';
import { getCracks } from './api';
import FixVerifyModal from './FixVerifyModal';

function DatabaseView({ onClose, model, officialEmail }) {
  const [cracks, setCracks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [verifying, setVerifying] = useState(null); // record being verified as fixed
  const [refreshKey, setRefreshKey] = useState(0);
  const fixedCount = cracks.filter((c) => c.status === 'fixed').length;

    useEffect(() => {
    async function fetchCracks() {
      try {
        const result = await getCracks();
        if (result.success) {
          setCracks(result.data);
        } else {
          setError('Failed to load database.');
        }
      } catch (err) {
        console.error(err);
        setError('Could not connect to database server.');
      } finally {
        setLoading(false);
      }
    }
    fetchCracks();
    
    // Poll for new detections every 3 seconds to keep DB synced
    const interval = setInterval(fetchCracks, 3000);
    return () => clearInterval(interval);
  }, [refreshKey]);

  return (
    <div className="db-overlay">
      <div className="db-modal">
        
        {/* Header */}
        <div className="db-header">
          <div className="db-title-group">
            <FiDatabase className="db-icon" />
            <div>
              <h2 className="db-title">Road Deformation Database</h2>
              <p className="db-subtitle">Restricted Access: BMC Officials Only · {cracks.length - fixedCount} open · {fixedCount} fixed</p>
            </div>
          </div>
          <button className="db-close" onClick={onClose}>
            <FiX size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="db-content">
          {loading ? (
            <div className="db-message">Loading database records...</div>
          ) : error ? (
            <div className="db-message db-error">
              <FiAlertCircle size={20} /> {error}
            </div>
          ) : cracks.length === 0 ? (
            <div className="db-message">No deformations have been recorded yet.</div>
          ) : (
            <div className="table-wrapper">
              <table className="db-table">
                <thead>
                  <tr>
                    <th><div className="th-content"><FiCheckSquare /> Fixed</div></th>
                    <th><div className="th-content"><FiImage /> Photo</div></th>
                    <th><div className="th-content"><FiClock /> Timestamp</div></th>
                    <th><div className="th-content"><FiMapPin /> Location (Lat, Lng)</div></th>
                    <th><div className="th-content"><FiActivity /> Confidence</div></th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cracks.map((crack) => {
                    const isFixed = crack.status === 'fixed';
                    return (
                    <tr key={crack.id} className={isFixed ? 'row-fixed' : ''}>
                      <td className="td-check">
                        <input
                          type="checkbox"
                          className="fix-checkbox"
                          checked={isFixed}
                          disabled={isFixed}
                          title={isFixed ? 'Verified as fixed' : 'Mark as fixed (camera check required)'}
                          onChange={() => setVerifying(crack)}
                        />
                      </td>
                      <td className="td-image">
                        <div className="thumb-pair">
                          <img src={crack.preview} alt="Detected Deformation" className="db-thumbnail" />
                          {isFixed && crack.fixedPreview && (
                            <img src={crack.fixedPreview} alt="After repair" className="db-thumbnail thumb-after" />
                          )}
                        </div>
                      </td>
                      <td className="td-time">
                        {new Date(crack.timestamp).toLocaleString()}
                      </td>
                      <td className="td-location">
                        {crack.gps ? (
                          <span>
                            {crack.gps.latitude.toFixed(5)}, {crack.gps.longitude.toFixed(5)}
                            {crack.gps.accuracy && ` (±${crack.gps.accuracy.toFixed(0)}m)`}
                          </span>
                        ) : (
                          <span className="no-data">Unknown</span>
                        )}
                      </td>
                      <td className="td-confidence">
                        <div className="conf-pill">
                          {(crack.confidence || 99.0).toFixed(1)}%
                        </div>
                      </td>
                      <td className="td-status">
                        {isFixed ? (
                          <span className="status-badge">
                            Fixed
                            {crack.fixedAt && <small>{new Date(crack.fixedAt).toLocaleDateString()}</small>}
                          </span>
                        ) : (
                          <span className="status-badge status-open">Open</span>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {verifying && (
        <FixVerifyModal
          crack={verifying}
          model={model}
          officialEmail={officialEmail}
          onClose={() => setVerifying(null)}
          onFixed={() => { setVerifying(null); setRefreshKey((k) => k + 1); }}
        />
      )}
    </div>
  );
}

export default DatabaseView;
