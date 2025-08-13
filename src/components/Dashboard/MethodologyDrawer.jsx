// src/components/Dashboard/MethodologyDrawer.jsx
import React from 'react';

export default function MethodologyDrawer() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener('OPEN_METHODOLOGY', handler);
    return () => window.removeEventListener('OPEN_METHODOLOGY', handler);
  }, []);

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={()=>setOpen(false)}>
      <div className="modal-content" onClick={(e)=>e.stopPropagation()}>
        <div className="modal-header">
          <h3>Methodology</h3>
          <button className="btn-close" onClick={()=>setOpen(false)} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <div style={{ display:'grid', gap:8 }}>
            <div>
              <strong>Scores (0–100):</strong> Weighted Z-scores across returns, risk, efficiency, tenure. Class-level coverage can reweight metrics with low presence.
            </div>
            <div>
              <strong>Coverage:</strong> Badges reflect minimum presence across YTD, 1Y, Sharpe, and StdDev 3Y within the current set.
            </div>
            <div>
              <strong>Benchmarks:</strong> Deltas require same-date rows for fund and benchmark.
            </div>
            <div>
              Learn more in Admin → Scoring for weight overlays and overrides.
            </div>
          </div>
        </div>
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={()=>setOpen(false)}>Close</button>
        </div>
      </div>
    </div>
  );
}

