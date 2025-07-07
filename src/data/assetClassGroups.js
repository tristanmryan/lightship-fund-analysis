// src/data/assetClassGroups.js

/**
 * Asset Class Groups Configuration
 * Defines the order and grouping of asset classes for reports
 * Matches the structure from your Excel performance report
 */

const assetClassGroups = [
  {
    name: 'U.S. Equity',
    classes: [
      'Large Cap Growth',
      'Large Cap Blend',
      'Large Cap Value',
      'Mid-Cap Growth',
      'Mid-Cap Blend',
      'Mid-Cap Value',
      'Small Cap Growth',
      'Small Cap Core',
      'Small Cap Value'
    ]
  },
  {
    name: 'International Equity',
    classes: [
      'International Stock (Large Cap)',
      'International Stock (Small/Mid Cap)',
      'Emerging Markets'
    ]
  },
  {
    name: 'Fixed Income',
    classes: [
      'Money Market',
      'Short Term Muni',
      'Intermediate Muni',
      'High Yield Muni',
      'Mass Muni Bonds',
      'Short Term Bonds',
      'Intermediate Term Bonds',
      'High Yield Bonds',
      'Foreign Bonds',
      'Multi Sector Bonds',
      'Non-Traditional Bonds',
      'Convertible Bonds'
    ]
  },
  {
    name: 'Alternative Investments',
    classes: [
      'Multi-Asset Income',
      'Preferred Stock',
      'Long/Short',
      'Real Estate',
      'Hedged/Enhanced',
      'Tactical',
      'Asset Allocation'
    ]
  },
  {
    name: 'Sector Funds',
    classes: [
      'Sector Funds'
    ]
  }
];

// Export for use in report generation
export default assetClassGroups;

// Helper function to get all asset classes in order
export function getAllAssetClasses() {
  return assetClassGroups.reduce((all, group) => {
    return [...all, ...group.classes];
  }, []);
}

// Helper function to get group name for an asset class
export function getGroupForAssetClass(assetClass) {
  const group = assetClassGroups.find(g => 
    g.classes.includes(assetClass)
  );
  return group ? group.name : 'Other';
}