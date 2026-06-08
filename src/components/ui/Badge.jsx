import React from 'react';

export default function Badge({ children, variant }) {
  const cls = `badge badge-${variant || 'neutral'}`;
  return <span className={cls}>{children}</span>;
}
