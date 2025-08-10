import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import NotesPanel from '../components/Dashboard/NotesPanel';

const mockList = jest.fn(async () => ([
  { id: '2', body: 'Second', created_at: new Date(Date.now()-1000).toISOString(), created_by: 'admin', decision: 'monitor', override_id: null },
  { id: '1', body: 'First', created_at: new Date(Date.now()-2000).toISOString(), created_by: 'admin', decision: null, override_id: null }
]));
const mockAdd = jest.fn(async ({ body }) => ({ id: '3', body, created_at: new Date().toISOString(), created_by: 'admin', decision: null, override_id: null }));

jest.mock('../services/researchNotesService', () => ({
  __esModule: true,
  default: {
    listNotes: (...args) => mockList(...args),
    addNote: (...args) => mockAdd(...args)
  }
}));

// Force flag ON for this test
beforeAll(() => { process.env.REACT_APP_ENABLE_NOTES = 'true'; });

test('NotesPanel adds a note and shows newest first', async () => {
  await act(async () => { render(<NotesPanel fundTicker="JQUA" />); });
  const textarea = await screen.findByPlaceholderText('Add a research note…');
  fireEvent.change(textarea, { target: { value: 'Newest note' } });
  fireEvent.click(screen.getByText('Add Note'));
  await waitFor(() => expect(screen.getByText('Newest note')).toBeInTheDocument());
});

test('NotesPanel hidden when flag is OFF', async () => {
  process.env.REACT_APP_ENABLE_NOTES = 'false';
  await act(async () => { render(<NotesPanel fundTicker="JQUA" />); });
  // Nothing renders
  expect(document.querySelector('.card')).not.toBeInTheDocument();
  process.env.REACT_APP_ENABLE_NOTES = 'true';
});

