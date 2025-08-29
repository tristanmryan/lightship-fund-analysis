import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Filter, X, Search } from 'lucide-react';

const LeftSidebar = ({ 
  filters,
  onFiltersChange,
  assetClasses = [],
  collapsed = false,
  onToggleCollapse
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState({
    assetClass: true,
    scoreRange: true,
    performance: true,
    risk: false
  });

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleAssetClassToggle = (assetClass) => {
    const current = filters.assetClasses || [];
    const updated = current.includes(assetClass)
      ? current.filter(c => c !== assetClass)
      : [...current, assetClass];
    
    onFiltersChange({ ...filters, assetClasses: updated });
  };

  const handleScoreRangeChange = (min, max) => {
    onFiltersChange({ ...filters, scoreRange: { min, max } });
  };

  const clearFilters = () => {
    onFiltersChange({
      assetClasses: [],
      scoreRange: { min: 0, max: 100 },
      search: '',
      recommended: false,
      performance: null,
      risk: null
    });
    setSearchTerm('');
  };

  const hasActiveFilters = () => {
    return (
      (filters.assetClasses || []).length > 0 ||
      filters.scoreRange?.min > 0 ||
      filters.scoreRange?.max < 100 ||
      filters.search ||
      filters.recommended ||
      filters.performance ||
      filters.risk
    );
  };

  if (collapsed) {
    return (
      <div className="left-sidebar collapsed">
        <button 
          className="expand-button"
          onClick={onToggleCollapse}
          title="Expand filters"
        >
          <Filter size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="left-sidebar">
      <div className="sidebar-header">
        <div className="sidebar-title">
          <Filter size={18} />
          <span>Quick Filters</span>
        </div>
        <div className="sidebar-actions">
          {hasActiveFilters() && (
            <button 
              className="clear-button"
              onClick={clearFilters}
              title="Clear all filters"
            >
              <X size={16} />
            </button>
          )}
          <button 
            className="collapse-button"
            onClick={onToggleCollapse}
            title="Collapse sidebar"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <div className="sidebar-content">
        {/* Search */}
        <div className="filter-section">
          <div className="search-container">
            <Search size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search funds..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                onFiltersChange({ ...filters, search: e.target.value });
              }}
              className="search-input"
            />
          </div>
        </div>

        {/* Asset Class Pills */}
        <div className="filter-section">
          <button 
            className="section-header"
            onClick={() => toggleSection('assetClass')}
          >
            {expandedSections.assetClass ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Asset Classes</span>
            {(filters.assetClasses || []).length > 0 && (
              <span className="filter-count">{(filters.assetClasses || []).length}</span>
            )}
          </button>
          
          {expandedSections.assetClass && (
            <div className="asset-class-pills">
              {assetClasses.map(assetClass => (
                <button
                  key={assetClass}
                  className={`asset-class-pill ${(filters.assetClasses || []).includes(assetClass) ? 'active' : ''}`}
                  onClick={() => handleAssetClassToggle(assetClass)}
                >
                  {assetClass}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Score Range Slider */}
        <div className="filter-section">
          <button 
            className="section-header"
            onClick={() => toggleSection('scoreRange')}
          >
            {expandedSections.scoreRange ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Score Range</span>
          </button>
          
          {expandedSections.scoreRange && (
            <div className="score-range-container">
              <div className="range-labels">
                <span>{filters.scoreRange?.min || 0}</span>
                <span>{filters.scoreRange?.max || 100}</span>
              </div>
              <div className="dual-range">
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.scoreRange?.min || 0}
                  onChange={(e) => handleScoreRangeChange(
                    parseInt(e.target.value),
                    filters.scoreRange?.max || 100
                  )}
                  className="range-slider range-min"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={filters.scoreRange?.max || 100}
                  onChange={(e) => handleScoreRangeChange(
                    filters.scoreRange?.min || 0,
                    parseInt(e.target.value)
                  )}
                  className="range-slider range-max"
                />
              </div>
              <div className="score-range-presets">
                <button 
                  className="preset-button"
                  onClick={() => handleScoreRangeChange(70, 100)}
                >
                  Excellent (70-100)
                </button>
                <button 
                  className="preset-button"
                  onClick={() => handleScoreRangeChange(50, 69)}
                >
                  Good (50-69)
                </button>
                <button 
                  className="preset-button"
                  onClick={() => handleScoreRangeChange(0, 49)}
                >
                  Review (0-49)
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Quick Toggles */}
        <div className="filter-section">
          <div className="toggle-filters">
            <label className="toggle-option">
              <input
                type="checkbox"
                checked={filters.recommended || false}
                onChange={(e) => onFiltersChange({ ...filters, recommended: e.target.checked })}
              />
              <span className="toggle-label">Recommended Only</span>
            </label>
          </div>
        </div>

        {/* Performance Filters */}
        <div className="filter-section">
          <button 
            className="section-header"
            onClick={() => toggleSection('performance')}
          >
            {expandedSections.performance ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Performance</span>
          </button>
          
          {expandedSections.performance && (
            <div className="performance-filters">
              {['YTD', '1Y', '3Y', '5Y'].map(period => (
                <button
                  key={period}
                  className={`filter-button ${filters.performance === period ? 'active' : ''}`}
                  onClick={() => onFiltersChange({ 
                    ...filters, 
                    performance: filters.performance === period ? null : period 
                  })}
                >
                  Top {period} Returns
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Risk Filters */}
        <div className="filter-section">
          <button 
            className="section-header"
            onClick={() => toggleSection('risk')}
          >
            {expandedSections.risk ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            <span>Risk Metrics</span>
          </button>
          
          {expandedSections.risk && (
            <div className="risk-filters">
              {['Low Volatility', 'High Sharpe', 'Low Drawdown'].map(risk => (
                <button
                  key={risk}
                  className={`filter-button ${filters.risk === risk ? 'active' : ''}`}
                  onClick={() => onFiltersChange({ 
                    ...filters, 
                    risk: filters.risk === risk ? null : risk 
                  })}
                >
                  {risk}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeftSidebar;