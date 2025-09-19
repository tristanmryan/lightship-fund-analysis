import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import AdminOverview from '../../components/Admin/AdminOverview';

jest.mock('../../services/fundService', () => ({
  __esModule: true,
  default: { 
    listSnapshotsWithDetailedCounts: jest.fn(async () => ([{ date: '2025-04-30', fundRows: 1200, benchmarkRows: 0 }])),
    listTradeDataCounts: jest.fn(async () => ([{ month: '2025-04-01', tradeRows: 500 }]))
  }
}));

jest.mock('../../services/supabase', () => {
  const makeFundsResult = () => {
    const base = { count: 5 };
    const thenable = {
      then: (res) => res(base)
    };
    // allow chaining eq/is that resolve to counts
    thenable.eq = () => Promise.resolve({ count: 2 });
    thenable.is = () => Promise.resolve({ count: 1 });
    return thenable;
  };
  return {
    __esModule: true,
    TABLES: { FUNDS: 'funds', ASSET_CLASSES: 'asset_classes', ASSET_CLASS_BENCHMARKS: 'asset_class_benchmarks' },
    supabase: {
      from: (table) => ({
        select: () => {
          if (table === 'funds') return makeFundsResult();
          if (table === 'asset_classes') return Promise.resolve({ data: [
            { id: 'ac1', code: 'LCG', name: 'Large Cap Growth' },
            { id: 'ac2', code: 'LCV', name: 'Large Cap Value' }
          ] });
          if (table === 'asset_class_benchmarks') return Promise.resolve({ data: [
            { asset_class_id: 'ac1', kind: 'primary', rank: 1 }
          ] });
          return Promise.resolve({ data: [] });
        }
      })
    }
  };
});

jest.mock('../../services/exportService', () => ({
  __esModule: true,
  exportRecommendedFundsCSV: jest.fn(() => {}),
  exportPrimaryBenchmarkMappingCSV: jest.fn(() => {})
}));

describe('AdminOverview', () => {
  it('renders lines and triggers navigation and exports', async () => {
    const onNavigate = jest.fn();
    render(<AdminOverview onNavigate={onNavigate} />);

    // wait for Exports menu (loaded state)
    await waitFor(() => expect(screen.getByText('Exports')).toBeInTheDocument());

    // Buttons present
    expect(screen.getAllByText('Go to Catalogs').length).toBeGreaterThan(0);
    expect(screen.getByText('Go to Mappings')).toBeInTheDocument();
    expect(screen.getAllByText('Go to Data Uploads').length).toBeGreaterThan(0);

    fireEvent.click(screen.getAllByText('Go to Catalogs')[0]);
    expect(onNavigate).toHaveBeenCalled();

    // Open Exports menu and trigger export actions
    fireEvent.click(screen.getByText('Exports'));
    fireEvent.click(screen.getByText('Recommended funds (CSV)'));
    fireEvent.click(screen.getByText('Exports'));
    fireEvent.click(screen.getByText('Primary benchmark mapping (CSV)'));
  });
});

