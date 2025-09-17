import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: {
    size: 'LETTER',
    orientation: 'landscape',
    paddingTop: 40,
    paddingRight: 40,
    paddingBottom: 40,
    paddingLeft: 40,
    fontFamily: 'Helvetica',
    fontSize: 10,
    color: '#1A1A1A',
  },
  header: {
    position: 'absolute', top: 15, left: 40, right: 40, fontSize: 9, color: '#5A5A5A',
    borderBottomWidth: 1, borderBottomColor: '#E8E8E8', paddingBottom: 8, marginBottom: 8,
    display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  footer: {
    position: 'absolute', bottom: 20, left: 40, right: 40, fontSize: 8, color: '#8A8A8A',
    borderTopWidth: 1, borderTopColor: '#E8E8E8', paddingTop: 8,
    display: 'flex', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  section: { marginTop: 24 },
  title: { fontSize: 16, fontWeight: 700, color: '#1E40AF', marginBottom: 6 },
  subText: { fontSize: 10, color: '#374151' },
  table: { marginTop: 10, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 4 },
  headerRow: { flexDirection: 'row', backgroundColor: '#4B5563' },
  headerCell: { color: '#FFFFFF', padding: 6, fontSize: 8, fontWeight: 600, textAlign: 'center', borderRightWidth: 0.25, borderRightColor: '#9CA3AF' },
  row: { flexDirection: 'row', borderTopWidth: 0.25, borderTopColor: '#F3F4F6' },
  cell: { padding: 6, fontSize: 8, textAlign: 'center', borderRightWidth: 0.25, borderRightColor: '#F3F4F6' },
  left: { textAlign: 'left' },
});

function PageHeader({ month, assetClass, ticker }) {
  return (
    <View style={styles.header} fixed>
      <Text style={{ fontWeight: 500, color: '#002F6C' }}>Raymond James | Trade Flow Summary</Text>
      <Text style={{ fontSize: 8, color: '#9CA3AF' }}>
        {month ? `Month ${month}` : 'Latest'}{assetClass ? ` • ${assetClass}` : ''}{ticker ? ` • ${ticker}` : ''}
      </Text>
    </View>
  );
}

function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <View>
        <Text style={{ fontWeight: 500, color: '#6B7280' }}>Confidential</Text>
        <Text style={{ fontSize: 7, marginTop: 2 }}>Member FINRA/SIPC</Text>
      </View>
      <View>
        <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
      </View>
      <View>
        <Text>Generated: {formatDate(new Date().toISOString())}</Text>
      </View>
    </View>
  );
}

function SimpleTable({ title, headers, rows }) {
  const data = Array.isArray(rows) ? rows : [];
  const widths = headers.map(() => Math.round(600 / headers.length));
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      <View style={styles.table}>
        <View style={styles.headerRow}>
          {headers.map((h, i) => (
            <Text key={String(i)} style={[styles.headerCell, { width: widths[i] }]}>{h}</Text>
          ))}
        </View>
        {data.map((r, ri) => (
          <View key={String(ri)} style={styles.row}>
            {r.map((c, ci) => (
              <Text key={String(ci)} style={[styles.cell, { width: widths[ci] }, ci === 0 && styles.left]}>{String(c ?? '')}</Text>
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

function TradeFlowsPDF({ data }) {
  const month = data?.month || null;
  const headersTrend = ['Month', 'Net Flow (USD)'];
  const trendRows = (data?.trend || []).map(r => [r.month || '', formatCurrency(r.net_flow || 0)]);

  const inflowHasDelta = Array.isArray(data?.topInflows) && data.topInflows.some(r => Object.prototype.hasOwnProperty.call(r || {}, 'delta_net'));
  const inflowHead = inflowHasDelta ? ['Ticker','Inflows','Outflows','Net','Delta Net vs Prior','Advisors'] : ['Ticker','Inflows','Outflows','Net','Advisors'];
  const inflowRows = (data?.topInflows || []).map(r => inflowHasDelta
    ? [r.ticker||'', formatCurrency(r.inflows||0), formatCurrency(r.outflows||0), formatCurrency(r.net_flow||0), formatCurrency(r.delta_net||0), String(r.advisors_trading||0)]
    : [r.ticker||'', formatCurrency(r.inflows||0), formatCurrency(r.outflows||0), formatCurrency(r.net_flow||0), String(r.advisors_trading||0)]
  );

  const outflowHasDelta = Array.isArray(data?.topOutflows) && data.topOutflows.some(r => Object.prototype.hasOwnProperty.call(r || {}, 'delta_net'));
  const outflowHead = outflowHasDelta ? ['Ticker','Inflows','Outflows','Net','Delta Net vs Prior','Advisors'] : ['Ticker','Inflows','Outflows','Net','Advisors'];
  const outflowRows = (data?.topOutflows || []).map(r => outflowHasDelta
    ? [r.ticker||'', formatCurrency(r.inflows||0), formatCurrency(r.outflows||0), formatCurrency(r.net_flow||0), formatCurrency(r.delta_net||0), String(r.advisors_trading||0)]
    : [r.ticker||'', formatCurrency(r.inflows||0), formatCurrency(r.outflows||0), formatCurrency(r.net_flow||0), String(r.advisors_trading||0)]
  );

  const heatmapHead = ['Asset Class','Inflows','Outflows','Net','Funds Traded','Advisors Trading (sum)'];
  const heatmapRows = (data?.heatmap || []).map(r => [
    r.asset_class || 'Unclassified',
    formatCurrency(r.inflows || 0),
    formatCurrency(r.outflows || 0),
    formatCurrency(r.net_flow || 0),
    String(r.funds_traded || 0),
    String(r.advisors_trading || 0),
  ]);

  const sentiments = [
    ['Advisors Buying', String(Number(data?.sentiment?.advisors_buying || 0))],
    ['Advisors Selling', String(Number(data?.sentiment?.advisors_selling || 0))],
    ['Advisors Neutral', String(Number(data?.sentiment?.advisors_neutral || 0))],
    ['Advisors Total', String(Number(data?.sentiment?.advisors_total || 0))],
  ];

  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <PageHeader month={month} assetClass={data?.assetClass} ticker={data?.ticker} />
        <View style={{ marginTop: 24 }}>
          <Text style={styles.title}>Overview</Text>
          <Text style={styles.subText}>Trading flows summary and participation metrics</Text>
        </View>
        <SimpleTable title="Advisor Participation" headers={["Metric","Value"]} rows={sentiments} />
        <SimpleTable title="Net Flow Trend" headers={headersTrend} rows={trendRows} />
        <SimpleTable title="Top Inflows" headers={inflowHead} rows={inflowRows} />
        <SimpleTable title="Top Outflows" headers={outflowHead} rows={outflowRows} />
        <SimpleTable title="Flow Heatmap by Asset Class" headers={heatmapHead} rows={heatmapRows} />
        <PageFooter />
      </Page>
    </Document>
  );
}

// Utils
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return 'N/A';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function formatCurrency(v) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Number(v || 0));
}

export default TradeFlowsPDF;

