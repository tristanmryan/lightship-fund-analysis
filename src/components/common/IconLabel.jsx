// src/components/common/IconLabel.jsx
import React from 'react';

export default function IconLabel({ icon: Icon, label, size = 16, strokeWidth = 1.75, gap = 6, style = {}, ...props }) {
  return (
    <span
      {...props}
      style={{ display: 'inline-flex', alignItems: 'center', gap, ...(style || {}) }}
    >
      {Icon ? <Icon size={size} strokeWidth={strokeWidth} aria-hidden /> : null}
      <span>{label}</span>
    </span>
  );
}

