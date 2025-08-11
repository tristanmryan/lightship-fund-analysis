// src/services/csvTemplate.js
export function createMonthlyTemplateCSV() {
  const header = [
    "Ticker","AsOfMonth","ytd_return","one_year_return","three_year_return","five_year_return","ten_year_return","sharpe_ratio","standard_deviation","expense_ratio","alpha","beta","manager_tenure","up_capture_ratio","down_capture_ratio","name","asset_class","is_recommended"
  ];
  const bom = '\uFEFF';
  const line = header.map(h => `"${h}"`).join(',') + '\r\n';
  return new Blob([bom, line], { type: 'text/csv;charset=utf-8' });
}

