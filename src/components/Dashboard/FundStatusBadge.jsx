import React from 'react';
import { Star, Target, CheckCircle, AlertCircle } from 'lucide-react';

/**
 * Fund Status Badge Component
 * Displays clean, professional status indicators for funds
 */
const FundStatusBadge = ({ 
  fund, 
  size = 'medium',
  showIcon = true,
  showText = true,
  className = ''
}) => {
  const isRecommended = fund.is_recommended || fund.recommended || fund.isRecommended;
  const isBenchmark = fund.isBenchmark || fund.is_benchmark;
  
  if (!isRecommended && !isBenchmark) {
    return null;
  }

  const sizeClasses = {
    small: 'text-xs px-2 py-1',
    medium: 'text-sm px-3 py-1.5',
    large: 'text-base px-4 py-2'
  };

  const iconSizes = {
    small: 12,
    medium: 14,
    large: 16
  };

  if (isBenchmark) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${sizeClasses[size]} ${className}`}
        title="Benchmark fund for this asset class"
      >
        {showIcon && <Target size={iconSizes[size]} className="text-blue-600" />}
        {showText && <span>Benchmark</span>}
      </div>
    );
  }

  if (isRecommended) {
    return (
      <div 
        className={`inline-flex items-center gap-1.5 font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${sizeClasses[size]} ${className}`}
        title="Firm-designated recommended fund"
      >
        {showIcon && <Star size={iconSizes[size]} className="text-emerald-600 fill-current" />}
        {showText && <span>Recommended</span>}
      </div>
    );
  }

  return null;
};

export default FundStatusBadge; 