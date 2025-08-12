import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SeedRecommendedFunds from '../../components/Admin/SeedRecommendedFunds';
import SeedBenchmarks from '../../components/Admin/SeedBenchmarks';

jest.mock('../../services/supabase', () => {
  const upsert = jest.fn();
  const update = jest.fn();
  const insert = jest.fn();
  return {
    __esModule: true,
    TABLES: { ASSET_CLASSES: 'asset_classes', FUNDS: 'funds', BENCHMARKS: 'benchmarks', ASSET_CLASS_BENCHMARKS: 'asset_class_benchmarks' },
    supabase: {
      from: (table) => ({
        select: () => ({ maybeSingle: () => Promise.resolve({ data: table === 'asset_classes' ? [{ id: 'ac1', name: 'Large Cap Growth' }] : null }), order: () => Promise.resolve({ data: [] }) }),
        upsert,
        update,
        insert,
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) })
      })
    }
  };
});

function makeCSV(content) {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], 'seed.csv', { type: 'text/csv' });
}

describe('Seeders validate-only', () => {
  it('SeedRecommendedFunds validate-only performs no writes', async () => {
    render(<SeedRecommendedFunds />);
    const csv = 'Ticker,AssetClass,Name\nIWF,Large Cap Growth,R1000 Growth\n';
    const file = makeCSV(csv);
    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    fireEvent.click(screen.getByText('Parse'));
    await waitFor(() => screen.getByText(/Rows parsed:/));
    fireEvent.click(screen.getByLabelText(/Validate only/));
    fireEvent.click(screen.getByText('Import'));
    await waitFor(() => screen.getByText(/Inserted|Updated|Skipped/));
  });

  it('SeedBenchmarks validate-only performs no writes', async () => {
    render(<SeedBenchmarks />);
    const csv = 'AssetClass,BenchmarkTicker,Name\nLarge Cap Growth,IWF,R1000 Growth\n';
    const file = makeCSV(csv);
    const input = document.querySelector('input[type="file"]');
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    fireEvent.click(screen.getByText('Parse'));
    await waitFor(() => screen.getByText(/Rows parsed:/));
    fireEvent.click(screen.getByLabelText(/Validate only/));
    fireEvent.click(screen.getByText('Import'));
    await waitFor(() => screen.getByText(/Inserted|Updated|Skipped|Mapped/));
  });
});

