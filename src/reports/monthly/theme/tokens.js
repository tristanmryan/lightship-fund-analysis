/**
 * Centralized theme tokens for consistent branding across PDF reports
 * Mirrors and extends src/assets/theme.js for report-specific needs
 */

import * as formatFunctions from '../shared/format.js';

/**
 * Get the complete report theme configuration
 * @returns {Object} Theme configuration object
 */
export function getReportTheme() {
  return {
    colors: COLORS,
    typography: TYPOGRAPHY,
    spacing: SPACING,
    borders: BORDERS,
    layout: LAYOUT,
    format: FORMAT_RULES
  };
}

/**
 * Raymond James brand colors and report-specific color palette
 */
const COLORS = {
  // Primary Raymond James brand colors
  brand: {
    primary: '#002F6C',      // Raymond James Blue
    secondary: '#FFFFFF',     // White
    accent: '#FFC200',       // Raymond James Gold
    darkBlue: '#001A3D',     // Darker blue for headers
    lightBlue: '#E6F2FF'     // Light blue for subtle backgrounds
  },
  
  // Text colors
  text: {
    primary: '#1F2937',      // Dark gray for body text
    secondary: '#6B7280',    // Medium gray for secondary text
    muted: '#9CA3AF',        // Light gray for captions
    white: '#FFFFFF',        // White text
    inverse: '#FFFFFF'       // White text on dark backgrounds
  },
  
  // Background colors
  background: {
    primary: '#FFFFFF',      // White background
    secondary: '#F9FAFB',    // Very light gray
    accent: '#F3F4F6',       // Light gray
    paper: '#FFFFFF'         // PDF page background
  },
  
  // Table colors
  table: {
    header: {
      background: '#4472C4',  // Professional blue
      text: '#FFFFFF'         // White text
    },
    border: '#D1D5DB',       // Light gray borders
    alternateRow: '#F8F9FA', // Very light gray for zebra striping
    hover: '#F3F4F6'         // Light gray for interactive states
  },
  
  // Benchmark row styling
  benchmark: {
    background: '#FFF3CD',   // Light gold background
    text: '#000000',         // Black text
    border: '#FFE69C'        // Slightly darker gold border
  },
  
  // Performance indicator colors
  performance: {
    excellent: '#C6EFCE',    // Light green - top 20%
    good: '#FFFF99',         // Light yellow - 20-40%
    average: '#FFEB9C',      // Light gold - 40-60%
    belowAverage: '#FFC7CE', // Light orange - 60-80%
    poor: '#FFC7CE'          // Light red - bottom 20%
  },
  
  // Status colors
  status: {
    positive: '#059669',     // Green for positive returns
    negative: '#DC2626',     // Red for negative returns
    neutral: '#6B7280',      // Gray for neutral/N/A
    recommended: '#FFC200'   // Gold for recommended funds
  },
  
  // Semantic colors
  semantic: {
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
    info: '#3B82F6'
  }
};

/**
 * Typography configuration
 */
const TYPOGRAPHY = {
  fonts: {
    // Primary brand font stack
    primary: {
      family: '"Raymond James Sans", "Segoe UI", system-ui, sans-serif',
      fallback: '"Segoe UI", "Helvetica Neue", Arial, sans-serif'
    },
    
    // Secondary font for data/numbers
    secondary: {
      family: '"SF Mono", "Monaco", "Inconsolata", "Roboto Mono", monospace',
      fallback: 'Consolas, "Courier New", monospace'
    },
    
    // System font fallback
    system: {
      family: 'system-ui, -apple-system, sans-serif',
      fallback: 'Arial, sans-serif'
    }
  },
  
  // Font sizes (in pt for PDF)
  sizes: {
    h1: 24,          // Main title
    h2: 20,          // Section headers
    h3: 16,          // Subsection headers
    h4: 14,          // Table headers
    body: 10,        // Regular body text
    small: 9,        // Fine print, captions
    tiny: 8          // Footnotes, disclaimers
  },
  
  // Font weights
  weights: {
    light: 300,
    normal: 400,
    medium: 500,
    semibold: 600,
    bold: 700
  },
  
  // Line heights (relative to font size)
  lineHeights: {
    tight: 1.2,
    normal: 1.4,
    relaxed: 1.6,
    loose: 1.8
  }
};

/**
 * Spacing scale (in pt for PDF)
 */
const SPACING = {
  // Base spacing unit
  unit: 4,
  
  // Common spacing values
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
  
  // Page margins
  page: {
    top: 45,       // ~16mm
    right: 40,     // ~14mm  
    bottom: 45,    // ~16mm
    left: 40       // ~14mm
  },
  
  // Section spacing
  section: {
    gap: 24,       // Space between sections
    headerGap: 16, // Space after section headers
    tableGap: 12   // Space around tables
  },
  
  // Table spacing
  table: {
    cellPadding: 8,
    rowHeight: 24,
    headerHeight: 28
  }
};

/**
 * Border and visual styling
 */
const BORDERS = {
  // Border widths
  widths: {
    thin: 0.5,
    normal: 1,
    thick: 2
  },
  
  // Border radius (for web preview)
  radius: {
    none: 0,
    sm: 2,
    md: 4,
    lg: 8
  },
  
  // Common border styles
  styles: {
    solid: 'solid',
    dashed: 'dashed',
    dotted: 'dotted'
  }
};

/**
 * Layout configuration
 */
const LAYOUT = {
  // Page configuration
  page: {
    format: 'Letter',        // 8.5" x 11"
    orientation: 'landscape', // Default orientation
    width: 792,              // Points (11" in landscape)
    height: 612              // Points (8.5" in landscape)
  },
  
  // Grid system
  grid: {
    columns: 12,
    gutterWidth: 16,
    maxWidth: 712            // Page width minus margins
  },
  
  // Content areas
  content: {
    headerHeight: 60,
    footerHeight: 40,
    sidebarWidth: 200
  }
};

/**
 * Formatting rules and conventions
 */
const FORMAT_RULES = {
  // Number formatting defaults
  numbers: {
    decimals: 2,
    thousandsSeparator: ',',
    decimalSeparator: '.'
  },
  
  // Percentage formatting
  percentages: {
    decimals: 2,
    showSign: true,        // Show + for positive values
    suffix: '%'
  },
  
  // Currency formatting
  currency: {
    symbol: '$',
    decimals: 2,
    position: 'before'     // Before or after the number
  },
  
  // Date formatting
  dates: {
    default: 'MM/DD/YYYY',
    long: 'MMMM D, YYYY',
    short: 'MMM YYYY'
  }
};

/**
 * Get CSS custom properties for the theme
 * Useful for generating CSS variables
 */
export function getCSSVariables(theme = getReportTheme()) {
  const variables = {};
  
  // Convert colors to CSS variables
  Object.entries(theme.colors).forEach(([category, colors]) => {
    if (typeof colors === 'object') {
      Object.entries(colors).forEach(([name, value]) => {
        variables[`--color-${category}-${name}`] = value;
      });
    } else {
      variables[`--color-${category}`] = colors;
    }
  });
  
  // Convert spacing to CSS variables
  Object.entries(theme.spacing).forEach(([name, value]) => {
    if (typeof value === 'object') {
      Object.entries(value).forEach(([subName, subValue]) => {
        variables[`--spacing-${name}-${subName}`] = `${subValue}pt`;
      });
    } else {
      variables[`--spacing-${name}`] = `${value}pt`;
    }
  });
  
  // Convert typography to CSS variables
  Object.entries(theme.typography.sizes).forEach(([name, value]) => {
    variables[`--font-size-${name}`] = `${value}pt`;
  });
  
  return variables;
}

/**
 * Generate theme-based utility classes
 */
export function getUtilityClasses(theme = getReportTheme()) {
  return {
    // Color utilities
    textColors: Object.keys(theme.colors.text).map(name => `.text-${name}`),
    backgroundColors: Object.keys(theme.colors.background).map(name => `.bg-${name}`),
    
    // Spacing utilities
    margins: Object.keys(theme.spacing).map(name => `.m-${name}`),
    paddings: Object.keys(theme.spacing).map(name => `.p-${name}`),
    
    // Typography utilities
    fontSizes: Object.keys(theme.typography.sizes).map(name => `.text-${name}`),
    fontWeights: Object.keys(theme.typography.weights).map(name => `.font-${name}`)
  };
}

// Re-export format functions for convenience
export * from '../shared/format.js';