import { pickHistoryValues } from '../utils/sparklineUtils';

const mk = (d, v) => ({ date: d, one_year_return: v, ytd_return: null });

test('pickHistoryValues clamps arrays by period', () => {
  const base = [];
  const today = new Date();
  for (let i = 0; i < 300; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    base.push(mk(d.toISOString().slice(0,10), i));
  }
  const y1 = pickHistoryValues(base, '1Y');
  const m1 = pickHistoryValues(base, '1M');
  const m3 = pickHistoryValues(base, '3M');
  const m6 = pickHistoryValues(base, '6M');

  expect(y1.length).toBeLessThanOrEqual(252);
  expect(m6.length).toBeLessThanOrEqual(126);
  expect(m3.length).toBeLessThanOrEqual(63);
  expect(m1.length).toBeLessThanOrEqual(21);
});

