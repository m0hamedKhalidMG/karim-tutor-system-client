import React from 'react';

export default function StatCard({ label, value, icon, color }) {
  return (
    <div className="card stat-card" style={{ borderLeft: `4px solid ${color || 'var(--primary)'}` }}>
      <div className="stat-header">
        <span className="stat-icon">{icon}</span>
        <div className="stat-value">{value}</div>
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
