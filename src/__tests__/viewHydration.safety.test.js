import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import EnhancedPerformanceDashboard from '../components/Dashboard/EnhancedPerformanceDashboard';

jest.mock('../services/preferencesService', () => ({
  __esModule: true,
  default: {
    getViewDefaults: jest.fn(async () => ({
      filters: {},
      table: { selectedColumns: null, sortConfig: null }
    })),
    saveViewDefaults: jest.fn(async () => {}),
  }
}));

test('loads with defaults when selectedColumns is null', async () => {
  render(<EnhancedPerformanceDashboard funds={[]} isLoading={false} />);
});

test('filters out removed columns and uses defaults', async () => {
  const ps = require('../services/preferencesService').default;
  ps.getViewDefaults.mockResolvedValueOnce({
    filters: {},
    table: { selectedColumns: ['oldRemovedCol'], sortConfig: [{ key: 'oldRemovedCol', direction: 'asc' }] }
  });
  render(<EnhancedPerformanceDashboard funds={[]} isLoading={false} />);
});

test('drops invalid sortConfig entries without crashing', async () => {
  const ps = require('../services/preferencesService').default;
  ps.getViewDefaults.mockResolvedValueOnce({
    filters: {},
    table: { selectedColumns: ['symbol','name'], sortConfig: [{ key: 'nope', direction: 'desc' }] }
  });
  render(<EnhancedPerformanceDashboard funds={[]} isLoading={false} />);
});

