import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import FundDetailsModal from '../components/FundDetailsModal';

test('FundDetailsModal sets aria-labelledby to a title element', () => {
  const fund = { displayName: 'Fund X', Symbol: 'FX', 'Asset Class': 'Class A' };
  render(<FundDetailsModal fund={fund} onClose={() => {}} />);
  const dialog = screen.getByRole('dialog');
  const titleId = dialog.getAttribute('aria-labelledby');
  expect(titleId).toBeTruthy();
  const title = document.getElementById(titleId);
  expect(title).toBeInTheDocument();
});

