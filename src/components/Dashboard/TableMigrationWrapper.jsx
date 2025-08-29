import React from 'react';

/**
 * Table Migration Wrapper
 * 
 * This wrapper provides a seamless migration path from legacy table components
 * to the unified DataTable architecture. It maintains backward compatibility
 * while allowing gradual adoption of the new system.
 */

// Feature flags
const USE_UNIFIED_TABLES = (process.env.REACT_APP_USE_UNIFIED_TABLES || 'false') === 'true';
const ENABLE_MIGRATION_LOGGING = (process.env.REACT_APP_ENABLE_MIGRATION_LOGGING || 'false') === 'true';

// Import unified components
import SimpleFundViewsUnified from './SimpleFundViews.unified';
import EnhancedFundTableUnified from './EnhancedFundTable.unified';
import ModernFundTableUnified from './ModernFundTable.unified';

// Import legacy components
import SimpleFundViewsLegacy from './SimpleFundViews';
import EnhancedFundTableLegacy from './EnhancedFundTable';
import ModernFundTableLegacy from './ModernFundTable';

/**
 * Migration logging utility
 */
function logMigrationEvent(componentName, isUnified, props) {
  if (!ENABLE_MIGRATION_LOGGING) return;
  
  console.group(`🔄 Table Migration: ${componentName}`);
  console.log(`Using ${isUnified ? 'Unified' : 'Legacy'} component`);
  console.log('Props:', Object.keys(props));
  console.log('Data length:', props.funds?.length || 0);
  console.groupEnd();
}

/**
 * Props compatibility checker
 */
function checkPropsCompatibility(componentName, props, expectedProps) {
  const missingProps = expectedProps.filter(prop => !(prop in props));
  const extraProps = Object.keys(props).filter(prop => !expectedProps.includes(prop));
  
  if (missingProps.length > 0 && ENABLE_MIGRATION_LOGGING) {
    console.warn(`${componentName}: Missing expected props:`, missingProps);
  }
  
  if (extraProps.length > 0 && ENABLE_MIGRATION_LOGGING) {
    console.info(`${componentName}: Extra props (may not be used):`, extraProps);
  }
  
  return { missingProps, extraProps };
}

/**
 * SimpleFundViews Migration Wrapper
 */
export const SimpleFundViews = (props) => {
  const expectedProps = [
    'funds', 'showTrends', 'initialView', 'onFundSelect', 'className', 'style'
  ];
  
  checkPropsCompatibility('SimpleFundViews', props, expectedProps);
  logMigrationEvent('SimpleFundViews', USE_UNIFIED_TABLES, props);
  
  return USE_UNIFIED_TABLES 
    ? <SimpleFundViewsUnified {...props} />
    : <SimpleFundViewsLegacy {...props} />;
};

/**
 * EnhancedFundTable Migration Wrapper
 */
export const EnhancedFundTable = (props) => {
  const expectedProps = [
    'funds', 'onFundSelect', 'showDetailModal', 'chartPeriod', 
    'initialSortConfig', 'initialSelectedColumns', 'onStateChange', 
    'registerExportHandler', 'presetSelector'
  ];
  
  checkPropsCompatibility('EnhancedFundTable', props, expectedProps);
  logMigrationEvent('EnhancedFundTable', USE_UNIFIED_TABLES, props);
  
  return USE_UNIFIED_TABLES 
    ? <EnhancedFundTableUnified {...props} />
    : <EnhancedFundTableLegacy {...props} />;
};

/**
 * ModernFundTable Migration Wrapper
 */
export const ModernFundTable = (props) => {
  const expectedProps = [
    'funds', 'onFundSelect', 'chartPeriod', 'initialSortConfig', 
    'initialSelectedColumns', 'onStateChange', 'registerExportHandler'
  ];
  
  checkPropsCompatibility('ModernFundTable', props, expectedProps);
  logMigrationEvent('ModernFundTable', USE_UNIFIED_TABLES, props);
  
  return USE_UNIFIED_TABLES 
    ? <ModernFundTableUnified {...props} />
    : <ModernFundTableLegacy {...props} />;
};

/**
 * Migration status utility
 */
export const getMigrationStatus = () => ({
  useUnifiedTables: USE_UNIFIED_TABLES,
  enableLogging: ENABLE_MIGRATION_LOGGING,
  version: USE_UNIFIED_TABLES ? 'unified' : 'legacy',
  featureFlags: {
    REACT_APP_USE_UNIFIED_TABLES: process.env.REACT_APP_USE_UNIFIED_TABLES,
    REACT_APP_ENABLE_MIGRATION_LOGGING: process.env.REACT_APP_ENABLE_MIGRATION_LOGGING,
    REACT_APP_ENABLE_VISUAL_REFRESH: process.env.REACT_APP_ENABLE_VISUAL_REFRESH
  }
});

/**
 * Migration utilities for testing and debugging
 */
export const MigrationUtils = {
  // Force use of unified components (for testing)
  forceUnified: (Component) => (props) => {
    logMigrationEvent(Component.name, true, props);
    return <Component {...props} />;
  },
  
  // Force use of legacy components (for rollback)
  forceLegacy: (Component) => (props) => {
    logMigrationEvent(Component.name, false, props);
    return <Component {...props} />;
  },
  
  // A/B testing wrapper
  abTest: (UnifiedComponent, LegacyComponent, testPercentage = 50) => (props) => {
    const useUnified = Math.random() * 100 < testPercentage;
    logMigrationEvent(`ABTest_${UnifiedComponent.name}`, useUnified, props);
    return useUnified 
      ? <UnifiedComponent {...props} />
      : <LegacyComponent {...props} />;
  },
  
  // Component comparison wrapper (renders both for visual comparison)
  compare: (UnifiedComponent, LegacyComponent) => (props) => {
    if (!ENABLE_MIGRATION_LOGGING) {
      // In production, just use the configured version
      return USE_UNIFIED_TABLES 
        ? <UnifiedComponent {...props} />
        : <LegacyComponent {...props} />;
    }
    
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
        <div>
          <h3 style={{ color: '#059669', marginBottom: '1rem' }}>
            🆕 Unified Component ({UnifiedComponent.name})
          </h3>
          <UnifiedComponent {...props} />
        </div>
        <div>
          <h3 style={{ color: '#dc2626', marginBottom: '1rem' }}>
            📜 Legacy Component ({LegacyComponent.name})
          </h3>
          <LegacyComponent {...props} />
        </div>
      </div>
    );
  }
};

/**
 * Migration status component for debugging
 */
export const MigrationStatus = () => {
  const status = getMigrationStatus();
  
  if (!ENABLE_MIGRATION_LOGGING) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '10px',
      right: '10px',
      background: '#1f2937',
      color: 'white',
      padding: '0.5rem',
      borderRadius: '0.375rem',
      fontSize: '0.75rem',
      zIndex: 9999,
      fontFamily: 'monospace'
    }}>
      <div>Tables: {status.version}</div>
      <div>Visual Refresh: {status.featureFlags.REACT_APP_ENABLE_VISUAL_REFRESH || 'false'}</div>
    </div>
  );
};

export default {
  SimpleFundViews,
  EnhancedFundTable,
  ModernFundTable,
  getMigrationStatus,
  MigrationUtils,
  MigrationStatus
};