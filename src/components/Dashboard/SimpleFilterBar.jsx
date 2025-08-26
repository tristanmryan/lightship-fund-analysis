import React from 'react';
import { Search, X } from 'lucide-react';

const SimpleFilterBar = ({ 
  searchTerm = '', 
  onSearchChange,
  selectedAssetClass = '',
  onAssetClassChange,
  assetClasses = [],
  showRecommendedOnly = false,
  onRecommendedOnlyChange,
  scoreRange = { min: 0, max: 100 },
  onScoreRangeChange,
  onClearFilters
}) => {
  const hasActiveFilters = () => {
    return searchTerm || 
           selectedAssetClass || 
           showRecommendedOnly || 
           scoreRange.min > 0 || 
           scoreRange.max < 100;
  };

  return (
    <div className="simple-filter-bar">
      <div className="filter-row">
        {/* Search */}
        <div className="search-container">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search funds by name or ticker..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>

        {/* Asset Class Filter */}
        <select
          value={selectedAssetClass}
          onChange={(e) => onAssetClassChange(e.target.value)}
          className="filter-select"
        >
          <option value="">All Asset Classes</option>
          {assetClasses.map(assetClass => (
            <option key={assetClass} value={assetClass}>
              {assetClass}
            </option>
          ))}
        </select>

        {/* Score Range */}
        <div className="score-range-filter">
          <label>Score Range:</label>
          <input
            type="number"
            min="0"
            max="100"
            value={scoreRange.min}
            onChange={(e) => onScoreRangeChange({
              ...scoreRange,
              min: parseInt(e.target.value) || 0
            })}
            className="score-input"
            placeholder="Min"
          />
          <span>-</span>
          <input
            type="number"
            min="0"
            max="100"
            value={scoreRange.max}
            onChange={(e) => onScoreRangeChange({
              ...scoreRange,
              max: parseInt(e.target.value) || 100
            })}
            className="score-input"
            placeholder="Max"
          />
        </div>

        {/* Recommended Only Toggle */}
        <label className="recommended-toggle">
          <input
            type="checkbox"
            checked={showRecommendedOnly}
            onChange={(e) => onRecommendedOnlyChange(e.target.checked)}
          />
          <span>Recommended Only</span>
        </label>

        {/* Clear Filters */}
        {hasActiveFilters() && (
          <button 
            onClick={onClearFilters}
            className="clear-filters-btn"
            title="Clear all filters"
          >
            <X size={16} />
            Clear
          </button>
        )}
      </div>
    </div>
  );
};

export default SimpleFilterBar;