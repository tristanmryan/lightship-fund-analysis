import React from 'react';
import { render, screen, fireEvent, waitFor, act, within } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock must be declared before component import to ensure it takes effect
jest.mock('../services/researchNotesService', () => ({
  __esModule: true,
  default: {
    listNotes: jest.fn(),
    addNote: jest.fn()
  }
}));

import notesService from '../services/researchNotesService';
import NotesPanel from '../components/Dashboard/NotesPanel';

// Force flag ON for this test
beforeAll(() => { process.env.REACT_APP_ENABLE_NOTES = 'true'; });

test('NotesPanel renders notes newest first (initial load)', async () => {
  notesService.listNotes.mockResolvedValue([
    { id: '2', body: 'Second', created_at: new Date(Date.now()-1000).toISOString(), created_by: 'admin', decision: 'monitor', override_id: null },
    { id: '1', body: 'First', created_at: new Date(Date.now()-2000).toISOString(), created_by: 'admin', decision: null, override_id: null }
  ]);
  const { container } = render(<NotesPanel fundTicker="JQUA" />);
  await screen.findByText('Second');
  await screen.findByText('First');
  const bodies = screen.getAllByTestId('note-body');
  expect(bodies[0]).toHaveTextContent('Second');
  expect(bodies[1]).toHaveTextContent('First');
});

test('NotesPanel adds a note and shows it at the top', async () => {
  notesService.listNotes.mockResolvedValue([]);
  notesService.addNote.mockImplementation(async ({ body, decision = null }) => ({ id: '3', body, created_at: new Date().toISOString(), created_by: 'admin', decision, override_id: null }));
  render(<NotesPanel fundTicker="JQUA" />);
  const textarea = await screen.findByPlaceholderText('Add a research note…');
  fireEvent.change(textarea, { target: { value: 'Newest note' } });
  fireEvent.click(screen.getByText('Add Note'));
  await screen.findByText('Newest note');
});

test('Decision text persists and is displayed', async () => {
  notesService.listNotes.mockResolvedValue([]);
  notesService.addNote.mockImplementation(async ({ body, decision = null }) => ({ id: '3', body, created_at: new Date().toISOString(), created_by: 'admin', decision, override_id: null }));
  render(<NotesPanel fundTicker="JQUA" />);
  const textarea = await screen.findByPlaceholderText('Add a research note…');
  fireEvent.change(textarea, { target: { value: 'Decisioned note' } });
  const select = screen.getByTestId('decision-select');
  fireEvent.change(select, { target: { value: 'approve' } });
  fireEvent.click(screen.getByText('Add Note'));
  const items = await screen.findAllByTestId('note-item');
  const first = items[0];
  expect(within(first).getByTestId('note-decision')).toHaveTextContent('approve');
  expect(within(first).getByTestId('note-body')).toHaveTextContent('Decisioned note');
});

test('Append-only UI (no edit/delete controls)', async () => {
  notesService.listNotes.mockResolvedValue([
    { id: '2', body: 'Second', created_at: new Date(Date.now()-1000).toISOString(), created_by: 'admin', decision: 'monitor', override_id: null }
  ]);
  render(<NotesPanel fundTicker="JQUA" />);
  await screen.findByText('Second');
  expect(screen.queryByText(/Edit/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/Delete/i)).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /save/i })).not.toBeInTheDocument();
});

test('NotesPanel hidden when flag is OFF', async () => {
  process.env.REACT_APP_ENABLE_NOTES = 'false';
  await act(async () => { render(<NotesPanel fundTicker="JQUA" />); });
  // Nothing renders
  expect(screen.queryByTestId('notes-panel')).not.toBeInTheDocument();
  process.env.REACT_APP_ENABLE_NOTES = 'true';
});

