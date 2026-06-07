import React from 'react';

const ComingSoon = ({ title, description }) => (
  <div className="coming-soon-page">
    <div className="coming-soon-card">
      <div className="coming-soon-icon">
        <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <h2>{title}</h2>
      <p className="coming-soon-tag">Coming Soon</p>
      {description && <p className="coming-soon-desc">{description}</p>}
    </div>
  </div>
);

export default ComingSoon;
