import React from 'react';

const PageHeader = ({ title, subtitle, actions }) => (
  <div className="page-shell-header">
    <div className="page-shell-header-left">
      <h1 className="page-shell-header-title">{title}</h1>
      {subtitle && <p className="page-shell-header-subtitle">{subtitle}</p>}
    </div>
    {actions && <div className="page-shell-header-actions">{actions}</div>}
  </div>
);

export default PageHeader;
