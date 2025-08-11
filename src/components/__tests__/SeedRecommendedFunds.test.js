import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SeedRecommendedFunds from '../../components/Admin/SeedRecommendedFunds';
import { supabase } from '../../services/supabase';

jest.mock('../../services/supabase', () => {
  const ac = [{ id: 'ac1', name: 'Large Cap Growth' }];
  const upsert = jest.fn(() => ({ select: () => ({ single: () => Promise.resolve({ data: { ticker: 'IWF' }, error: null }) }) }));
  return {
    __esModule: true,
    TABLES: { ASSET_CLASSES: 'asset_classes', FUNDS: 'funds' },
    supabase: {
      from: (table) => ({
        select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }), order: () => Promise.resolve({ data: [] }) }),
        upsert,
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) })
      })
    }
  };
});

function makeCSV(content) {
  const blob = new Blob([content], { type: 'text/csv' });
  return new File([blob], 'seed.csv', { type: 'text/csv' });
}

describe('SeedRecommendedFunds', () => {
  it('parses and imports valid rows', async () => {
    render(<SeedRecommendedFunds />);
    const csv = 'Ticker,AssetClass,Name\nIWF,Large Cap Growth,R1000 Growth\n';
    const file = makeCSV(csv);
    const realInput = document.querySelector('input[type="file"]');
    Object.defineProperty(realInput, 'files', { value: [file] });
    fireEvent.change(realInput);
    fireEvent.click(screen.getByText('Parse'));

    await waitFor(() => expect(screen.getByText(/Rows parsed:/i)).toBeInTheDocument());
    fireEvent.click(screen.getByText('Import'));
    await waitFor(() => expect(screen.getByText(/Inserted|Updated|Skipped/)).toBeInTheDocument());
  });
});

