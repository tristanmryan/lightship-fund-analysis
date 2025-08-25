// Legacy theme (stable for existing consumers/tests)
const legacyTheme = {
  colors: {
    primary: '#002D72', // Deep navy blue
    primaryLight: '#005EB8', // Lighter blue
    accent: '#F5F6FA', // Light gray background
    white: '#FFFFFF',
    text: '#1A1A1A',
    border: '#E5E7EB',
    gold: '#C9B037', // Subtle gold accent
    error: '#DC2626',
    success: '#059669',
    info: '#3B82F6',
    tableRow: '#F5F6FA',
    tableRowAlt: '#E9EDF5',
    shadow: 'rgba(0,45,114,0.08)',
  },
  font: {
    family: `'Segoe UI', 'Roboto', 'Open Sans', Arial, sans-serif`,
    size: '16px',
    weight: '400',
    headingWeight: '600',
    lineHeight: 1.5,
  },
  spacing: {
    xs: '0.25rem',
    sm: '0.5rem',
    md: '1rem',
    lg: '2rem',
    xl: '3rem',
  },
  borderRadius: '0.5rem',
  shadow: '0 2px 8px 0 rgba(0,45,114,0.08)',
};

// Phase‑1 refreshed tokens (flag-gated at the CSS layer / opted-in consumers)
export const refreshTokens = {
  colors: {
    primary: '#1F4E79',
    primaryLight: '#3B6EA6',
    primaryDark: '#163A59',
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB',
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    text: '#111827',
    textLight: '#6B7280',
  },
  fontFamily:
    "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  spacing: {
    md: '0.75rem',
    lg: '1.25rem',
  },
};

export default legacyTheme;

