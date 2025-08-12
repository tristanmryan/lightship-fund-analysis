// Lightweight test to verify template CSV header and BOM
import { describe, it, expect } from '@jest/globals';
import { createMonthlyTemplateCSV, createLegacyMonthlyTemplateCSV } from '../../services/csvTemplate';

describe('Monthly CSV Template', () => {
  it('CSV template has BOM + quoted header + CRLF', async () => {
    const blob = createMonthlyTemplateCSV();
    // Fallback for environments without Blob.arrayBuffer
    const buf = await new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      } catch (e) {
        reject(e);
      }
    });
    // BOM bytes
    expect(buf[0]).toBe(0xEF);
    expect(buf[1]).toBe(0xBB);
    expect(buf[2]).toBe(0xBF);
    // Find first CRLF and slice header bytes after BOM
    let eol = -1;
    for (let i = 3; i < buf.length - 1; i++) {
      if (buf[i] === 0x0D && buf[i + 1] === 0x0A) { eol = i; break; }
    }
    expect(eol).toBeGreaterThan(3);
    const headerBytes = buf.slice(3, eol);
    const firstLine = String.fromCharCode(...headerBytes);
    expect(firstLine).toBe('"Ticker","ytd_return","one_year_return","three_year_return","five_year_return","ten_year_return","sharpe_ratio","standard_deviation_3y","standard_deviation_5y","expense_ratio","alpha","beta","manager_tenure","up_capture_ratio","down_capture_ratio","name","asset_class","is_recommended"');
    // Ends with CRLF
    expect(buf[buf.length - 2]).toBe(0x0D);
    expect(buf[buf.length - 1]).toBe(0x0A);
  });

  it('Legacy template includes AsOfMonth', async () => {
    const blob = createLegacyMonthlyTemplateCSV();
    const buf = await new Promise((resolve, reject) => {
      try {
        const reader = new FileReader();
        reader.onload = () => resolve(new Uint8Array(reader.result));
        reader.onerror = reject;
        reader.readAsArrayBuffer(blob);
      } catch (e) {
        reject(e);
      }
    });
    // BOM bytes
    expect(buf[0]).toBe(0xEF);
    expect(buf[1]).toBe(0xBB);
    expect(buf[2]).toBe(0xBF);
    // First line
    let eol = -1;
    for (let i = 3; i < buf.length - 1; i++) {
      if (buf[i] === 0x0D && buf[i + 1] === 0x0A) { eol = i; break; }
    }
    const headerBytes = buf.slice(3, eol);
    const firstLine = String.fromCharCode(...headerBytes);
    expect(firstLine).toBe('"Ticker","AsOfMonth","ytd_return","one_year_return","three_year_return","five_year_return","ten_year_return","sharpe_ratio","standard_deviation_3y","standard_deviation_5y","expense_ratio","alpha","beta","manager_tenure","up_capture_ratio","down_capture_ratio","name","asset_class","is_recommended"');
  });
});

