import React from 'react';
import ScoreTooltip from './Dashboard/ScoreTooltip';
import { getScoreColor, getScoreLabel } from '../services/scoringService.js';

const ScoreBadge = ({ score, fund, size = 'medium' }) => {
  if (score === null || score === undefined) {
    return <span className="score-badge score-badge-unknown">N/A</span>;
  }

  // Centralized score color and label (Scoring tab policy)
  const color = getScoreColor(score);
  const scoreText = getScoreLabel(score);

  const sizeClass = `score-badge-${size}`;

  const badge = (
    <span
      className={`score-badge ${sizeClass}`}
      style={{
        backgroundColor: color,
        color: '#FFFFFF',
        borderColor: color
      }}
    >
      {scoreText} ({score.toFixed(1)})
    </span>
  );

  // Wrap with tooltip if fund data is available
  if (fund) {
    return (
      <ScoreTooltip fund={fund} score={score}>
        {badge}
      </ScoreTooltip>
    );
  }

  return badge;
};

export default ScoreBadge; 
