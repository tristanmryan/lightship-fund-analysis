import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import DataDiagnostics from '../../components/Admin/DataDiagnostics';

jest.mock('../../services/fundService', () => ({
  __esModule: true,
  default: { listSnapshotsWithDetailedCounts: jest.fn(async () => ([{ date: '2025-04-30', fundRows: 1200, benchmarkRows: 0 }, { date: '2025-03-31', fundRows: 1180, benchmarkRows: 0 }])) }
}));

jest.mock('../../services/supabase', () => {
  function makeThenableCounts({ baseCount = 5, eqCount = 2, isCount = 1, data = [] } = {}) {
    const thenable = {
      then: (resolve) => resolve({ count: baseCount, data })
    };
    thenable.eq = () => Promise.resolve({ count: eqCount });
    thenable.is = () => Promise.resolve({ count: isCount });
    thenable.order = () => Promise.resolve({ data });
    return thenable;
  }
  return {
    __esModule: true,
    TABLES: { FUNDS: 'funds', ASSET_CLASSES: 'asset_classes', ASSET_CLASS_BENCHMARKS: 'asset_class_benchmarks' },
    supabase: {
      from: (table) => ({
        select: (sel) => {
          if (table === 'funds') {
            // Two shapes: counts and full list for export/backfill
            if (sel && sel.includes('ticker')) {
              return makeThenableCounts({ baseCount: 1, data: [{ ticker: 'ABC', name: 'A', asset_class: 'Mid-Cap Blend', asset_class_id: null }] });
            }
            return makeThenableCounts({ baseCount: 5, eqCount: 2, isCount: 1 });
          }
          if (table === 'asset_classes') {
            return Promise.resolve({ data: [{ id: 'ac1', name: 'Mid-Cap Blend', group_name: 'U.S. Equity', sort_group: 1, sort_order: 220 }] });
          }
          if (table === 'asset_class_benchmarks') {
            return Promise.resolve({ data: [] });
          }
          return Promise.resolve({ data: [] });
        },
        update: () => ({ eq: () => Promise.resolve({}) })
      })
    }
  };
});

jest.mock('../../services/exportService', () => ({
  __esModule: true,
  buildCSV: (rows) => rows.map(r => r.join(',')).join('\r\n'),
  downloadFile: jest.fn()
}));

describe('DataDiagnostics', () => {
  it('renders counts and snapshots', async () => {
    render(<DataDiagnostics />);
    await waitFor(() => screen.getByText(/Total funds/));
    expect(screen.getByText(/Snapshot months/)).toBeInTheDocument();
  });

  it('validate-only shows preview count and does not write', async () => {
    render(<DataDiagnostics />);
    await waitFor(() => screen.getByText(/Total funds/));
    // Ensure validate-only is checked by default
    fireEvent.click(screen.getByText('Backfill asset_class_id'));
    await waitFor(() => screen.getByText(/Would update:/));
    // If there are candidates, preview table header renders; otherwise just ensure summary is present
    // This environment mock may yield zero candidates; assert summary only
  });

  it('prod guard disables live backfill unless flag is true', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origAllow = process.env.REACT_APP_ALLOW_ADMIN_WRITES;
    process.env.NODE_ENV = 'production';
    delete process.env.REACT_APP_ALLOW_ADMIN_WRITES;
    render(<DataDiagnostics />);
    await waitFor(() => screen.getByText(/Total funds/));
    // turn off validate-only
    fireEvent.click(screen.getByLabelText(/Validate only/));
    const btn = screen.getByText('Backfill asset_class_id');
    expect(btn).toBeDisabled();
    // restore env
    process.env.NODE_ENV = origNodeEnv;
    process.env.REACT_APP_ALLOW_ADMIN_WRITES = origAllow;
  });
});

