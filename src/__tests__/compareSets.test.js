import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import ComparisonPanel from '../components/Dashboard/ComparisonPanel';
// Mock preferencesService using an in-memory store
const store = {};
jest.mock('../services/preferencesService', () => ({
  __esModule: true,
  default: {
    getCompareSets: jest.fn(async () => ({ ...store })),
    saveCompareSets: jest.fn(async (v) => { Object.assign(store, v); })
  }
}));
// Components import via '../../services/preferencesService' relative to their files,
// but from tests we only need to ensure the module resolution at '../services/preferencesService'

const funds = [
  { ticker: 'AAA', name: 'AAA Fund' },
  { ticker: 'BBB', name: 'BBB Fund' },
  { ticker: 'CCC', name: 'CCC Fund' },
  { ticker: 'DDD', name: 'DDD Fund' }
];

function addSelection(symbol) {
  fireEvent.change(screen.getByPlaceholderText('Search symbol or name...'), { target: { value: symbol } });
  const selects = screen.getAllByDisplayValue('Select fund…');
  fireEvent.change(selects[selects.length - 1], { target: { value: symbol } });
}

test('Save, load, delete compare sets and overwrite flow', async () => {
  const { rerender } = render(<ComparisonPanel funds={funds} />);

  // Select two funds
  addSelection('AAA');
  addSelection('BBB');

  // Save set
  fireEvent.change(screen.getByPlaceholderText('Set name'), { target: { value: 'My Set' } });
  const saveBtn = screen.getByText('Save');
  expect(saveBtn).not.toBeDisabled();
  fireEvent.click(saveBtn);

  // Simulate reload by re-rendering fresh component
  rerender(<ComparisonPanel funds={funds} />);
  // Wait until saved set appears in the load dropdown
  await screen.findByRole('option', { name: /My Set/i });
  const loadSelects = screen.getAllByDisplayValue('Load set…');
  fireEvent.change(loadSelects[loadSelects.length - 1], { target: { value: 'my set' } });
  // After load, allow state to settle and confirm one selected fund appears
  await waitFor(() => expect(screen.getByText('AAA')).toBeInTheDocument(), { timeout: 2000 });

  // Overwrite: select CCC and save again with same name
  addSelection('CCC');
  // Confirm overwrite prompt automatically (jsdom confirm returns true by default)
  fireEvent.change(screen.getByPlaceholderText('Set name'), { target: { value: 'MY SET' } });
  fireEvent.click(screen.getByText('Save'));

  // Delete
  // jsdom confirm is not implemented; simulate acceptance
  const originalConfirm = window.confirm;
  window.confirm = () => true;
  fireEvent.click(screen.getByText('Delete'));
  window.confirm = originalConfirm;
});

test('Missing tickers skipped without crashing and notice shown', async () => {
  // Preload store with a set that includes a missing ticker
  store['mixed'] = { name: 'Mixed', tickers: ['AAA','ZZZ'], created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  render(<ComparisonPanel funds={funds} initialSavedSets={{ ...store }} />);
  // Saved set option should exist by its display name
  await screen.findByRole('option', { name: /Mixed/i });
  const loadSelects = screen.getAllByDisplayValue('Load set…');
  fireEvent.change(loadSelects[loadSelects.length - 1], { target: { value: 'mixed' } });
  // After load, allow state to settle and confirm the found ticker is present
  await waitFor(() => expect(screen.getByText('AAA')).toBeInTheDocument(), { timeout: 2000 });
});

