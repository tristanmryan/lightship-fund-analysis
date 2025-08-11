// Lightweight test to verify template CSV header
import { describe, it, expect } from '@jest/globals';

// Import the function from the component module
import { createMonthlyTemplateBlob } from '../Admin/MonthlySnapshotUpload.jsx';

function blobToText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

describe('Monthly CSV Template', () => {
  it('produces a BOM-prefixed CSV with the expected header and CRLF', async () => {
    const blob = createMonthlyTemplateBlob();
    const text = await blobToText(blob);
    // Expect BOM at start
    expect(text.charCodeAt(0)).toBe(0xFEFF);
    const firstLine = text.split('\r\n')[0];
    expect(firstLine).toBe('"Ticker","AsOfMonth","ytd_return","one_year_return","three_year_return","five_year_return","ten_year_return","sharpe_ratio","standard_deviation","expense_ratio","alpha","beta","manager_tenure","up_capture_ratio","down_capture_ratio","name","asset_class","is_recommended"');
    // Only header + trailing CRLF
    expect(text.endsWith('\r\n')).toBe(true);
  });
});

