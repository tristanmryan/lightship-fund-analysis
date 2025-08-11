// src/services/csvTemplate.js
export function createMonthlyTemplateCSV() {
  const header = [
    "Ticker","AsOfMonth","ytd_return","one_year_return","three_year_return","five_year_return","ten_year_return",
    "sharpe_ratio","standard_deviation_3y","standard_deviation_5y","expense_ratio","alpha","beta","manager_tenure","up_capture_ratio","down_capture_ratio",
    "name","asset_class","is_recommended"
  ];
  const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]); // UTF-8 BOM bytes
  const line = `"${header.join('","')}"\r\n`; // quoted header + CRLF
  // Rely on Blob to encode string to UTF-8; prepend explicit BOM bytes
  return new Blob([BOM, line], { type: 'text/csv;charset=utf-8' });
}

