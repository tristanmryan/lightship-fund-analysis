import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import SnapshotManager from '../../components/Admin/SnapshotManager';
import fundService from '../../services/fundService';

jest.mock('../../services/fundService', () => ({
  __esModule: true,
  default: {
    listSnapshotsWithCounts: jest.fn(),
    deleteSnapshotMonth: jest.fn()
  }
}));

describe('SnapshotManager', () => {
  it('lists snapshots and supports delete', async () => {
    fundService.listSnapshotsWithCounts.mockResolvedValueOnce([
      { date: '2025-04-30', rows: 1200 },
      { date: '2025-03-31', rows: 1180 }
    ]);
    fundService.deleteSnapshotMonth.mockResolvedValue(true);

    render(<SnapshotManager />);

    expect(await screen.findByText('2025-04-30')).toBeInTheDocument();
    expect(screen.getByText('1200')).toBeInTheDocument();

    const del = screen.getAllByText('Delete')[0];
    // stub confirm
    const oldConfirm = window.confirm;
    window.confirm = () => true;
    fireEvent.click(del);
    await waitFor(() => expect(fundService.deleteSnapshotMonth).toHaveBeenCalled());
    window.confirm = oldConfirm;
  });
});

