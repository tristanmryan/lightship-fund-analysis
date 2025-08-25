// Raymond James-inspired theme
const visualRefresh = process.env.REACT_APP_ENABLE_VISUAL_REFRESH === 'true';

const baseColors = {
  primary: '#002D72',
  primaryLight: '#005EB8',
  accent: '#F5F6FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  border: '#E5E7EB',
  gold: '#C9B037',
  error: '#DC2626',
  success: '#059669',
  info: '#3B82F6',
  tableRow: '#F5F6FA',
  tableRowAlt: '#E9EDF5',
  shadow: 'rgba(0,45,114,0.08)',
};

const refreshedColors = {
  primary: '#1F4E79',
  primaryLight: '#2E5F8A',
  accent: '#F5F6FA',
  white: '#FFFFFF',
  text: '#1A1A1A',
  border: '#D1D5DB',
  gold: '#C9B037',
  error: '#DC2626',
  success: '#059669',
  info: '#3B82F6',
  tableRow: '#F5F6FA',
  tableRowAlt: '#E9EDF5',
  shadow: 'rgba(0,45,114,0.08)',
};

const colors = visualRefresh ? refreshedColors : baseColors;

const baseFont = `'Segoe UI', 'Roboto', 'Open Sans', Arial, sans-serif`;
const refreshFont = `'Inter', 'Segoe UI', 'Roboto', 'Open Sans', Arial, sans-serif`;

export const theme = {
  colors,
  typography: {
    family: visualRefresh ? refreshFont : baseFont,
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

export default theme;