// src/components/common/DecisionIcon.jsx
import React from 'react';
import { CheckCircle2, Eye, XCircle, PauseCircle } from 'lucide-react';

const ICONS = {
  approve: CheckCircle2,
  monitor: Eye,
  reject: XCircle,
  hold: PauseCircle
};

export default function DecisionIcon({ decision, size = 14, strokeWidth = 1.75, style = {} }) {
  const key = String(decision || '').toLowerCase();
  const Icon = ICONS[key];
  if (!Icon) return null;
  return <Icon size={size} strokeWidth={strokeWidth} aria-hidden style={style} />;
}

