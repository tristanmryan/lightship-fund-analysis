import React from 'react';
import ScoreTooltip from './Dashboard/ScoreTooltip';

const ScoreBadge = ({ score, fund, size = 'medium' }) => {
  if (score === null || score === undefined) {
    return <span className="score-badge score-badge-unknown">N/A</span>;
  }

  // Determine score category and color
  let scoreClass = 'score-badge-neutral';
  let scoreText = 'Neutral';

  if (score >= 80) {
    scoreClass = 'score-badge-excellent';
    scoreText = 'Excellent';
  } else if (score >= 60) {
    scoreClass = 'score-badge-good';
    scoreText = 'Good';
  } else if (score >= 40) {
    scoreClass = 'score-badge-fair';
    scoreText = 'Fair';
  } else if (score >= 20) {
    scoreClass = 'score-badge-poor';
    scoreText = 'Poor';
  } else {
    scoreClass = 'score-badge-very-poor';
    scoreText = 'Very Poor';
  }

  const sizeClass = `score-badge-${size}`;

  const badge = (
    <span className={`score-badge ${scoreClass} ${sizeClass}`}>
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