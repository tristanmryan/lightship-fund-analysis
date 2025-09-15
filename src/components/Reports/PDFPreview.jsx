// src/components/Reports/PDFPreview.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { PDFViewer } from '@react-pdf/renderer';
import MonthlyReportPDF from '../../reports/monthly/template/MonthlyReportPDF.js';
import { shapeReportData } from '../../reports/monthly/data/shapeData.js';

export default function PDFPreview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [scope, setScope] = useState('all'); // 'all' | 'recommended'
  const [asOf, setAsOf] = useState(typeof window !== 'undefined' ? (window.__AS_OF_MONTH__ || null) : null);
  const [headerBg, setHeaderBg] = useState('#1F4E79');
  const [headerFontSize, setHeaderFontSize] = useState(7);
  const [cellFontSize, setCellFontSize] = useState(6);
  const [rowMinHeight, setRowMinHeight] = useState(20);
  const [nameColWidth, setNameColWidth] = useState(140);
  const [highlightRecommended, setHighlightRecommended] = useState(true);
  const [recBg, setRecBg] = useState('#F0FDF4');
  const [recAccent, setRecAccent] = useState('#34D399');
  const [bmkBg, setBmkBg] = useState('#FFD699');
  const [bmkAccent, setBmkAccent] = useState('#F59E0B');
  const [headerHeight, setHeaderHeight] = useState(70);
  const [footerHeight, setFooterHeight] = useState(50);
  const [sectionHeaderHeight, setSectionHeaderHeight] = useState(30);
  const [tableHeaderHeight, setTableHeaderHeight] = useState(20);
  const [sectionSpacing, setSectionSpacing] = useState(20);

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function buildThemeContent() {
    // Build a theme.js file string using current knobs
    return `// src/reports/monthly/template/theme.js\n\nconst theme = {\n  // Typography\n  fonts: { base: 'Carlito' },\n  fontSizes: {\n    base: 8,\n    header: 9,\n    footer: 8,\n    title: 18,\n    coverMain: 32,\n    coverSubtitle: 18,\n    coverReportType: 14,\n    tableHeader: ${Number(headerFontSize) || 7},\n    tableCell: ${Number(cellFontSize) || 6},\n    fundName: 7,\n  },\n\n  // Colors\n  colors: {\n    text: '#1A1A1A',\n    subtleText: '#6B7280',\n    title: '#111827',\n    brand: '#1E40AF',\n    headerDivider: '#E8E8E8',\n    footerDivider: '#E8E8E8',\n    headerText: '#002F6C',\n    number: '#0F172A',\n  },\n\n  // Table styling\n  table: {\n    headerBg: '${headerBg}',\n    headerBorder: '#9CA3AF',\n    rowBorder: '#F9FAFB',\n    cellBorder: '#F3F4F6',\n    rowAltBg: '#FCFCFC',\n    recommendedAccent: '${recAccent}',\n    recommendedBg: '${recBg}',\n    benchmarkBg: '${bmkBg}',\n    benchmarkAccent: '${bmkAccent}',\n\n    score: {\n      excellent: '#E8F5E8',\n      good: '#FFF8E1',\n      average: '#FFF3E0',\n      belowAverage: '#FFEBEE',\n      poor: '#FFEBEE',\n    },\n\n    columnWidths: {\n      ticker: 50,\n      name: ${Number(nameColWidth) || 140},\n      ytd: 60,\n      oneY: 60,\n      threeY: 60,\n      fiveY: 60,\n      sharpe: 60,\n      std3y: 60,\n      std5y: 60,\n      expense: 60,\n      tenure: 60,\n      score: 50,\n    },\n\n    cellPadding: 4,\n  },\n\n  layout: {\n    pagePadding: 40,\n    rowMinHeight: ${Number(rowMinHeight) || 20},\n    sectionSpacing: ${Number(sectionSpacing) || 20},\n    headerHeight: ${Number(headerHeight) || 70},\n    footerHeight: ${Number(footerHeight) || 50},\n    sectionHeaderHeight: ${Number(sectionHeaderHeight) || 30},\n    tableHeaderHeight: ${Number(tableHeaderHeight) || 20},\n  },\n};\n\nexport default theme;\n`;
  }

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const payload = {
        asOf,
        selection: { scope, tickers: null },
        options: { landscape: true, includeTOC: true },
      };
      const shaped = await shapeReportData(payload);
      setData(shaped);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [asOf, scope]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
      <h2 style={{ margin: 0 }}>Monthly PDF — Live Preview</h2>
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label>
          Scope:&nbsp;
          <select value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all">All funds</option>
            <option value="recommended">Recommended only</option>
          </select>
        </label>
        <label>
          As of (YYYY-MM-DD):&nbsp;
          <input
            type="text"
            placeholder="Latest"
            value={asOf || ''}
            onChange={(e) => setAsOf(e.target.value || null)}
            style={{ width: 140 }}
          />
        </label>
        <label>
          Table Header Background:&nbsp;
          <input type="color" value={headerBg} onChange={(e) => setHeaderBg(e.target.value)} />
        </label>
        <label>
          Table Header Font Size:&nbsp;
          <input type="number" min={5} max={14} value={headerFontSize} onChange={(e) => setHeaderFontSize(Number(e.target.value))} style={{ width: 64 }} />
        </label>
        <label>
          Table Cell Font Size:&nbsp;
          <input type="number" min={5} max={14} value={cellFontSize} onChange={(e) => setCellFontSize(Number(e.target.value))} style={{ width: 64 }} />
        </label>
        <label>
          Table Row Height:&nbsp;
          <input type="number" min={16} max={40} value={rowMinHeight} onChange={(e) => setRowMinHeight(Number(e.target.value))} style={{ width: 72 }} />
        </label>
        <label>
          Fund Name Column Width:&nbsp;
          <input type="number" min={100} max={240} value={nameColWidth} onChange={(e) => setNameColWidth(Number(e.target.value))} style={{ width: 84 }} />
      </label>
        <label>
          Highlight Background (Recommended):&nbsp;
          <input type="color" value={recBg} onChange={(e) => setRecBg(e.target.value)} />
        </label>
        <label>
          Highlight Accent (Recommended):&nbsp;
          <input type="color" value={recAccent} onChange={(e) => setRecAccent(e.target.value)} />
        </label>
        <label>
          Benchmark Row Background:&nbsp;
          <input type="color" value={bmkBg} onChange={(e) => setBmkBg(e.target.value)} />
        </label>
        <label>
          Benchmark Row Accent:&nbsp;
          <input type="color" value={bmkAccent} onChange={(e) => setBmkAccent(e.target.value)} />
        </label>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <input type="checkbox" checked={highlightRecommended} onChange={(e) => setHighlightRecommended(e.target.checked)} />
          Highlight Recommended
        </label>
        {/* Layout controls */}
        <label>
          Page Header Height:&nbsp;
          <input type="number" min={40} max={120} value={headerHeight} onChange={(e) => setHeaderHeight(Number(e.target.value))} style={{ width: 72 }} />
        </label>
        <label>
          Page Footer Height:&nbsp;
          <input type="number" min={30} max={120} value={footerHeight} onChange={(e) => setFooterHeight(Number(e.target.value))} style={{ width: 72 }} />
        </label>
        <label>
          Section Header Height:&nbsp;
          <input type="number" min={20} max={60} value={sectionHeaderHeight} onChange={(e) => setSectionHeaderHeight(Number(e.target.value))} style={{ width: 72 }} />
        </label>
        <label>
          Table Header Height:&nbsp;
          <input type="number" min={16} max={40} value={tableHeaderHeight} onChange={(e) => setTableHeaderHeight(Number(e.target.value))} style={{ width: 84 }} />
        </label>
        <label>
          Section Spacing:&nbsp;
          <input type="number" min={8} max={40} value={sectionSpacing} onChange={(e) => setSectionSpacing(Number(e.target.value))} style={{ width: 84 }} />
        </label>
        <button className="btn" onClick={load} disabled={loading}>Reload</button>
        {loading && <span>Loading...</span>}
        {error && <span style={{ color: 'crimson' }}>Error: {error}</span>}
      </div>

      {data ? (
        <PDFViewer style={{ width: '100%', height: '92vh', border: '1px solid #e5e7eb' }} showToolbar>
          <MonthlyReportPDF
            data={data}
            options={{
              landscape: true,
              includeTOC: true,
              headerBg,
              headerFontSize,
              cellFontSize,
              rowMinHeight,
              colWidths: { name: nameColWidth },
              highlightRecommended,
              recBg,
              recAccent,
              bmkBg,
              bmkAccent,
              headerHeight,
              footerHeight,
              sectionHeaderHeight,
              tableHeaderHeight,
              sectionSpacing,
            }}
          />
        </PDFViewer>
      ) : (
        loading ? <div>Loading...</div> : <div>No data to render.</div>
      )}

      {/* Save as default (export theme.js) */}
      <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
        <button className="btn" onClick={() => downloadText('theme.js', buildThemeContent())}>
          Save Current Settings as Default (Download theme.js)
        </button>
      </div>
    </div>
  );
}

