import crypto from 'crypto';
import Papa from 'papaparse';

export function parseCsv(csvText) {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  if (result.errors && result.errors.length) {
    const msg = result.errors.slice(0, 3).map(e => `${e.type}:${e.code}:${e.message}`).join('; ');
    throw new Error(`CSV parse error(s): ${msg}`);
  }
  return result.data || [];
}

function getHashSecret() {
  return (
    process.env.CLIENT_ID_HASH_SECRET ||
    process.env.HOLDINGS_HASH_SECRET ||
    process.env.ACCOUNT_HASH_SECRET ||
    'dev-only-secret'
  );
}

export function hashClientId(raw) {
  const input = (raw ?? '').toString().trim();
  const secret = getHashSecret();
  return crypto.createHmac('sha256', secret).update(input, 'utf8').digest('hex');
}

export function normalizeTicker(t) {
  if (!t) return '';
  return String(t).trim().toUpperCase().replace(/[^A-Z0-9.\-]/g, '');
}

export function parseCurrency(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (s === '') return null;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/[$,]/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function parseNumber(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  let s = String(v).trim();
  if (s === '') return null;
  let negative = false;
  if (s.startsWith('(') && s.endsWith(')')) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/,/g, '').trim();
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

export function isCashHoldingRow(row) {
  const symbol = (row['Symbol'] || '').toString().trim();
  const productName = (row['Product Name'] || '').toString().trim().toLowerCase();
  // Rows with no symbol and Product Name = Usd are cash-only lines in sample
  return !symbol && productName === 'usd';
}

export const map = {
  holding(row, snapshotDate) {
    if (isCashHoldingRow(row)) return null; // skip cash-only rows
    const advisor = String(row['FA #'] || '').trim();
    const account = String(row['Account #'] || '').trim();
    const ticker = normalizeTicker(row['Symbol']);
    if (!advisor || !account || !ticker) return null; // minimal required
    const quantity = parseNumber(row['Quantity']);
    const marketValue = parseCurrency(row['Current Value']);
    if (quantity === null || marketValue === null) return null;
    return {
      snapshot_date: snapshotDate,
      advisor_id: advisor,
      client_id: hashClientId(account),
      ticker,
      cusip: row['CUSIP'] ? String(row['CUSIP']).trim() : null,
      quantity,
      market_value: marketValue
    };
  },
  trade(row) {
    const advisor = String(row['FA'] || '').trim();
    const account = String(row['Account'] || '').trim();
    const txTypeRaw = String(row['Transaction Type'] || '').trim().toUpperCase();
    const tradeType = txTypeRaw === 'PURCHASE' ? 'BUY' : txTypeRaw === 'SALE' ? 'SELL' : null;
    if (!advisor || !account || !tradeType) return null;
    const parseDate = (s) => {
      if (!s) return null;
      // Input like M/D/YYYY -> to YYYY-MM-DD
      const d = new Date(s);
      if (Number.isNaN(d.getTime())) return null;
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    const tradeDate = parseDate(row['Trade Date']);
    const settleDate = parseDate(row['Settlement Date']);
    if (!tradeDate) return null;

    const amountRaw = parseCurrency(row['Amount']);
    let principal = amountRaw;
    // Enforce sign by trade type regardless of raw sign style
    if (principal !== null) {
      if (tradeType === 'BUY' && principal < 0) principal = -principal;
      if (tradeType === 'SELL' && principal > 0) principal = -principal;
    }

    const shares = parseNumber(row['Shares']);
    const price = parseNumber(row['Price']);
    const cancelledFlag = String(row['Cancelled Flag'] || '').trim().toUpperCase() === 'Y';

    return {
      trade_date: tradeDate,
      settlement_date: settleDate,
      advisor_id: advisor,
      client_id: hashClientId(account),
      external_trade_id: row['Trade Number'] ? String(row['Trade Number']).trim() : null,
      ticker: normalizeTicker(row['Symbol']),
      cusip: row['CUSIP'] ? String(row['CUSIP']).trim() : null,
      trade_type: tradeType,
      product_type: row['Product Type'] ? String(row['Product Type']).trim() : null,
      quantity: shares,
      principal_amount: principal,
      cancelled: cancelledFlag,
      price
    };
  }
};

