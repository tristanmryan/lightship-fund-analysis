/**
 * ScoringTab.jsx - Main scoring management interface
 * 
 * This component provides a clean interface for configuring scoring weights
 * with real-time preview capabilities using the new clean scoring services.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sliders, Save, RotateCcw, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import WeightSliders from './WeightSliders.jsx';
import ScorePreview from './ScorePreview.jsx';
import { 
  getWeightsForAssetClass, 
  saveAssetClassWeights, 
  resetAssetClassWeights,
  getGlobalDefaultWeights,
  validateWeights,
  getWeightsDifferenceSummary
} from '../../services/weightService.js';
import { calculateAssetClassScores } from '../../services/scoringService.js';
import { METRICS as METRICS_REGISTRY } from '../../services/metricsRegistry.js';
import { getFundsWithPerformance } from '../../services/fundDataService.js';

const ScoringTab = () => {
  // Asset class and fund data
  const [assetClasses, setAssetClasses] = useState([]);
  const [selectedAssetClassId, setSelectedAssetClassId] = useState('');
  const [selectedAssetClassName, setSelectedAssetClassName] = useState('');
  const [funds, setFunds] = useState([]);
  const [previewFunds, setPreviewFunds] = useState([]);
  
  // Weight management
  const [currentWeights, setCurrentWeights] = useState(getGlobalDefaultWeights());
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // UI state
  const [message, setMessage] = useState({ type: '', text: '' });
  const [showApplyBanner, setShowApplyBanner] = useState(false);
  
  // Message management (define early so callbacks can depend on it)
  const showMessage = useCallback((type, text) => {
    setMessage({ type, text });
    if (type !== 'error') {
      setTimeout(() => setMessage({ type: '', text: '' }), 4000);
    }
  }, []);
  
  const clearMessage = useCallback(() => {
    setMessage({ type: '', text: '' });
  }, []);
  
  // Load weights for selected asset class
  const loadWeightsForAssetClass = useCallback(async (assetClassId) => {
    try {
      const weights = await getWeightsForAssetClass(assetClassId);
      setCurrentWeights(weights);
      setHasUnsavedChanges(false);
      
      // Show customization status
      const diffSummary = getWeightsDifferenceSummary(weights);
      if (diffSummary.hasCustomWeights) {
        showMessage('info', `${diffSummary.totalDifferences} custom weights loaded`);
      } else {
        showMessage('info', 'Using global default weights');
      }
    } catch (error) {
      console.error('Error loading weights:', error);
      showMessage('error', 'Failed to load weights, using defaults');
      setCurrentWeights(getGlobalDefaultWeights());
    }
  }, [showMessage]);

  // Load asset classes and initial data (after callbacks are defined)
  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoading(true);
        
        // Load fund data to get asset classes
        const fundsData = await getFundsWithPerformance();
        setFunds(fundsData);
        
        // Extract unique asset classes
        const uniqueAssetClasses = new Map();
        fundsData.forEach(fund => {
          if (fund.asset_class_id && fund.asset_class_name) {
            uniqueAssetClasses.set(fund.asset_class_id, {
              id: fund.asset_class_id,
              name: fund.asset_class_name,
              code: fund.asset_class_code || fund.asset_class_name
            });
          }
        });
        
        const assetClassList = Array.from(uniqueAssetClasses.values())
          .sort((a, b) => a.name.localeCompare(b.name));
        
        setAssetClasses(assetClassList);
        
        // Auto-select first asset class
        if (assetClassList.length > 0) {
          const firstAssetClass = assetClassList[0];
          setSelectedAssetClassId(firstAssetClass.id);
          setSelectedAssetClassName(firstAssetClass.name);
          await loadWeightsForAssetClass(firstAssetClass.id);
        }
        
      } catch (error) {
        console.error('Error loading initial data:', error);
        showMessage('error', 'Failed to load asset class data');
      } finally {
        setLoading(false);
      }
    }
    
    loadInitialData();
  }, [loadWeightsForAssetClass, showMessage]);
  
  
  
  // Handle asset class selection change
  const handleAssetClassChange = useCallback(async (assetClassId) => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Continue without saving?')) {
        return;
      }
    }
    
    const assetClass = assetClasses.find(ac => ac.id === assetClassId);
    if (!assetClass) return;
    
    setSelectedAssetClassId(assetClassId);
    setSelectedAssetClassName(assetClass.name);
    await loadWeightsForAssetClass(assetClassId);
  }, [assetClasses, hasUnsavedChanges, loadWeightsForAssetClass]);
  
  // Handle weight changes from sliders
  const handleWeightChange = useCallback((metric, value) => {
    setCurrentWeights(prev => ({
      ...prev,
      [metric]: value
    }));
    setHasUnsavedChanges(true);
    clearMessage();
  }, [clearMessage]);
  
  // Calculate real-time preview scores
  const previewScores = useMemo(() => {
    if (!selectedAssetClassName || previewFunds.length === 0) return [];
    
    try {
      const start = performance.now();
      const scores = calculateAssetClassScores(previewFunds, currentWeights);
      const end = performance.now();
      
      // Performance monitoring for real-time requirements
      if (end - start > 50) {
        console.warn(`Scoring calculation took ${(end - start).toFixed(1)}ms (target: <50ms)`);
      }
      
      return scores;
    } catch (error) {
      console.error('Error calculating preview scores:', error);
      return previewFunds;
    }
  }, [selectedAssetClassName, previewFunds, currentWeights]);

  // Compute per-metric coverage within the selected asset class (0..1)
  const coverageMap = useMemo(() => {
    const map = {};
    if (!Array.isArray(previewFunds) || previewFunds.length === 0) return map;
    const total = previewFunds.length;
    Object.keys(METRICS_REGISTRY).forEach((metric) => {
      const count = previewFunds.reduce((acc, f) => {
        const v = f[metric];
        return acc + ((v !== null && v !== undefined && !isNaN(v)) ? 1 : 0);
      }, 0);
      map[metric] = total > 0 ? count / total : 0;
    });
    return map;
  }, [previewFunds]);
  
  // Update preview funds when asset class changes
  useEffect(() => {
    if (!selectedAssetClassName) {
      setPreviewFunds([]);
      return;
    }
    
    const classFunds = funds.filter(fund => 
      (fund.asset_class_name || fund.asset_class) === selectedAssetClassName
    );
    setPreviewFunds(classFunds);
  }, [selectedAssetClassName, funds]);
  
  // Save weights to database
  const handleSave = useCallback(async () => {
    if (!selectedAssetClassId) return;
    
    try {
      setSaving(true);
      
      // Validate weights first
      const validation = validateWeights(currentWeights);
      if (!validation.isValid) {
        showMessage('error', `Invalid weights: ${validation.errors.join(', ')}`);
        return;
      }
      
      // Show warnings but allow save
      if (validation.warnings.length > 0) {
        showMessage('warning', validation.warnings.join('; '));
      }
      
      // Save to database
      await saveAssetClassWeights(selectedAssetClassId, currentWeights);
      setHasUnsavedChanges(false);
      
      const diffSummary = getWeightsDifferenceSummary(currentWeights);
      showMessage('success', `Saved ${diffSummary.totalDifferences} custom weights for ${selectedAssetClassName}`);
      // Reveal CTA banner to apply changes globally across the app
      setShowApplyBanner(true);
      
    } catch (error) {
      console.error('Error saving weights:', error);
      showMessage('error', 'Failed to save weights');
    } finally {
      setSaving(false);
    }
  }, [selectedAssetClassId, selectedAssetClassName, currentWeights, showMessage]);
  
  // Reset weights to defaults
  const handleReset = useCallback(async () => {
    if (!window.confirm('Reset all weights for this asset class to global defaults?')) return;
    
    try {
      setLoading(true);
      
      if (selectedAssetClassId) {
        await resetAssetClassWeights(selectedAssetClassId);
      }
      
      const defaultWeights = getGlobalDefaultWeights();
      setCurrentWeights(defaultWeights);
      setHasUnsavedChanges(false);
      
      showMessage('success', `Reset weights for ${selectedAssetClassName} to defaults`);
      
    } catch (error) {
      console.error('Error resetting weights:', error);
      showMessage('error', 'Failed to reset weights');
    } finally {
      setLoading(false);
    }
  }, [selectedAssetClassId, selectedAssetClassName, showMessage]);
  
  
  
  // Weight validation for UI feedback
  const validation = useMemo(() => validateWeights(currentWeights), [currentWeights]);
  const diffSummary = useMemo(() => getWeightsDifferenceSummary(currentWeights), [currentWeights]);
  
  if (loading && assetClasses.length === 0) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '16px', color: '#6B7280' }}>Loading scoring configuration...</div>
      </div>
    );
  }
  
  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      height: '100vh',
      backgroundColor: '#F9FAFB' 
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 24px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Sliders size={24} style={{ color: '#3B82F6' }} />
          <h1 style={{ 
            margin: 0, 
            fontSize: '24px', 
            fontWeight: '600', 
            color: '#111827' 
          }}>
            Scoring Configuration
          </h1>
        </div>
        
        <p style={{ 
          margin: '8px 0 0 36px', 
          color: '#6B7280', 
          fontSize: '14px' 
        }}>
          Configure metric weights and see real-time scoring impact
        </p>
      </div>
      
      {/* Asset Class Selector */}
      <div style={{
        padding: '16px 24px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <label style={{ 
            fontSize: '14px', 
            fontWeight: '500', 
            color: '#374151',
            minWidth: '100px'
          }}>
            Asset Class:
          </label>
          
          <select
            value={selectedAssetClassId}
            onChange={(e) => handleAssetClassChange(e.target.value)}
            disabled={loading}
            style={{
              padding: '8px 12px',
              border: '1px solid #D1D5DB',
              borderRadius: '6px',
              backgroundColor: 'white',
              fontSize: '14px',
              minWidth: '200px',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            <option value="">Select an asset class...</option>
            {assetClasses.map(ac => (
              <option key={ac.id} value={ac.id}>
                {ac.name} ({funds.filter(f => f.asset_class_id === ac.id).length} funds)
              </option>
            ))}
          </select>
          
          {diffSummary.hasCustomWeights && (
            <div style={{
              padding: '4px 8px',
              backgroundColor: '#EFF6FF',
              color: '#1D4ED8',
              fontSize: '12px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <Info size={12} />
              {diffSummary.totalDifferences} custom weights
            </div>
          )}
        </div>
      </div>
      
      {/* Status Message */}
      {message.text && (
        <div style={{
          padding: '12px 24px',
          backgroundColor: 
            message.type === 'error' ? '#FEF2F2' : 
            message.type === 'warning' ? '#FFFBEB' :
            message.type === 'success' ? '#F0FDF4' : '#EFF6FF',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          {message.type === 'error' && <AlertTriangle size={16} style={{ color: '#DC2626' }} />}
          {message.type === 'success' && <CheckCircle size={16} style={{ color: '#059669' }} />}
          {message.type === 'warning' && <AlertTriangle size={16} style={{ color: '#D97706' }} />}
          {message.type === 'info' && <Info size={16} style={{ color: '#2563EB' }} />}
          
          <span style={{ 
            fontSize: '14px', 
            color: 
              message.type === 'error' ? '#DC2626' : 
              message.type === 'warning' ? '#D97706' :
              message.type === 'success' ? '#059669' : '#2563EB'
          }}>
            {message.text}
          </span>
          
          {message.type === 'error' && (
            <button 
              onClick={clearMessage}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                color: '#DC2626',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
      
      {/* Apply Scoring Banner (CTA) */}
      {showApplyBanner && (
        <div style={{
          padding: '12px 24px',
          backgroundColor: '#FFFBEB',
          borderBottom: '1px solid #FDE68A',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertTriangle size={16} style={{ color: '#D97706' }} />
          <div style={{ fontSize: '14px', color: '#92400E' }}>
            You have saved new scoring weights. Apply changes to the app?
          </div>
          <button
            onClick={() => {
              try {
                window.dispatchEvent(new CustomEvent('APPLY_NEW_SCORING'));
              } catch {}
              setShowApplyBanner(false);
            }}
            style={{
              marginLeft: 'auto',
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              backgroundColor: '#F59E0B',
              color: 'white',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Apply new scoring to app
          </button>
        </div>
      )}

      {/* Main Content */}
      {selectedAssetClassId && (
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          gap: '24px', 
          padding: '24px',
          overflow: 'hidden'
        }}>
          {/* Left Panel - Weight Sliders */}
          <div style={{
            flex: '1',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            padding: '24px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              marginBottom: '20px'
            }}>
              <h2 style={{ 
                margin: 0, 
                fontSize: '18px', 
                fontWeight: '600', 
                color: '#111827' 
              }}>
                Metric Weights
              </h2>
              
              {/* Controls */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                {/* Add Metric selector */}
                <AddMetricControl
                  weights={currentWeights}
                  coverageMap={coverageMap}
                  onAdd={(metricKey) => {
                    // Set a sensible starting weight
                    const start = 0.05;
                    handleWeightChange(metricKey, start);
                  }}
                />
                <button
                  onClick={handleReset}
                  disabled={loading}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 12px',
                    border: '1px solid #D1D5DB',
                    borderRadius: '6px',
                    backgroundColor: 'white',
                    color: '#374151',
                    fontSize: '14px',
                    cursor: loading ? 'not-allowed' : 'pointer'
                  }}
                >
                  <RotateCcw size={14} />
                  Reset
                </button>
                
                <button
                  onClick={handleSave}
                  disabled={saving || !hasUnsavedChanges || !validation.isValid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    border: 'none',
                    borderRadius: '6px',
                    backgroundColor: hasUnsavedChanges && validation.isValid ? '#3B82F6' : '#9CA3AF',
                    color: 'white',
                    fontSize: '14px',
                    fontWeight: '500',
                    cursor: (saving || !hasUnsavedChanges || !validation.isValid) ? 'not-allowed' : 'pointer'
                  }}
                >
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </div>
            
            <WeightSliders
              weights={currentWeights}
              onWeightChange={handleWeightChange}
              validation={validation}
              diffSummary={diffSummary}
              coverageMap={coverageMap}
            />
          </div>
          
          {/* Right Panel - Score Preview */}
          <div style={{
            flex: '1',
            backgroundColor: 'white',
            borderRadius: '8px',
            border: '1px solid #E5E7EB',
            padding: '24px',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column'
          }}>
            <ScorePreview
              funds={previewScores}
              assetClassName={selectedAssetClassName}
              weights={currentWeights}
              loading={loading}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default ScoringTab;

// Inline AddMetric control (simple, no external styles)
function AddMetricControl({ weights, coverageMap, onAdd }) {
  const [selected, setSelected] = React.useState('');

  const options = React.useMemo(() => {
    const opts = Object.keys(METRICS_REGISTRY)
      .filter((k) => (weights?.[k] ?? 0) === 0)
      .map((k) => ({ key: k, label: METRICS_REGISTRY[k].label, coverage: coverageMap?.[k] ?? 0 }))
      .filter((o) => o.coverage > 0)
      .sort((a, b) => b.coverage - a.coverage || a.label.localeCompare(b.label));
    return opts;
  }, [weights, coverageMap]);

  if (options.length === 0) return null;

  const fmtPct = (p) => `${Math.round((p || 0) * 100)}%`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        style={{
          padding: '8px 12px',
          border: '1px solid #D1D5DB',
          borderRadius: 6,
          backgroundColor: 'white',
          fontSize: 14,
          minWidth: 220
        }}
      >
        <option value="">Add metric…</option>
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label} · {fmtPct(o.coverage)} coverage
          </option>
        ))}
      </select>
      <button
        disabled={!selected}
        onClick={() => {
          if (!selected) return;
          onAdd?.(selected);
          setSelected('');
        }}
        style={{
          padding: '8px 12px',
          border: 'none',
          borderRadius: 6,
          backgroundColor: '#10B981',
          color: 'white',
          fontWeight: 600,
          cursor: selected ? 'pointer' : 'not-allowed'
        }}
      >
        Add
      </button>
    </div>
  );
}
