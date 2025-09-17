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
    position: 'absolute',
    top: 15,
    left: 40,
    right: 40,
    fontSize: 9,
    color: '#5A5A5A',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
    paddingBottom: 8,
    marginBottom: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    fontSize: 8,
    color: '#8A8A8A',
    borderTopWidth: 1,
    borderTopColor: '#E8E8E8',
    paddingTop: 8,
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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

function PageHeader({ snapshotDate }) {
  return (
    <View style={styles.header} fixed>
      <Text style={{ fontWeight: 500, color: '#002F6C' }}>Raymond James | Advisor Portfolio Summary</Text>
      <Text style={{ fontSize: 8, color: '#9CA3AF' }}>Snapshot {formatDate(snapshotDate)}</Text>
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

function KPI({ label, value }) {
  return (
    <View style={{ width: 180, borderWidth: 0.5, borderColor: '#E5E7EB', borderRadius: 6, padding: 10 }}>
      <Text style={{ fontSize: 18, fontWeight: 700, color: '#111827', textAlign: 'center' }}>{value}</Text>
      <Text style={{ fontSize: 9, color: '#6B7280', marginTop: 4, textAlign: 'center' }}>{label}</Text>
    </View>
  );
}

function KPISection({ data }) {
  const totalAum = Number(data?.portfolio?.totalAum || 0);
  const unique = Number(data?.portfolio?.uniqueHoldings || 0);
  const clients = Number(data?.summary?.client_count || 0);
  const adoptionPct = totalAum > 0 ? ((Number(data?.portfolio?.recommendedAum || 0) / totalAum) * 100).toFixed(1) + '%' : '0%';
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Portfolio KPIs</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <KPI label="Total AUM (USD)" value={formatCurrency(totalAum)} />
        <KPI label="Unique Holdings" value={String(unique)} />
        <KPI label="Clients" value={String(clients)} />
        <KPI label="% In Recommended" value={adoptionPct} />
      </View>
    </View>
  );
}

function AllocationTable({ rows }) {
  const data = Array.isArray(rows) ? rows : [];
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Allocation by Asset Class</Text>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, { width: 240, textAlign: 'left' }]}>Asset Class</Text>
          <Text style={[styles.headerCell, { width: 160 }]}>Amount (USD)</Text>
          <Text style={[styles.headerCell, { width: 120 }]}>% of AUM</Text>
        </View>
        {data.map((a, i) => (
          <View style={styles.row} key={String(i)}>
            <Text style={[styles.cell, styles.left, { width: 240 }]}>{a?.asset_class || 'Unclassified'}</Text>
            <Text style={[styles.cell, { width: 160 }]}>{formatCurrency(Number(a?.amount || 0))}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{formatPercent(Number(a?.pct || 0) * 100)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function PositionsTable({ rows }) {
  const data = Array.isArray(rows) ? rows.slice(0, 20) : [];
  return (
    <View style={styles.section}>
      <Text style={styles.title}>Top Positions</Text>
      <View style={styles.table}>
        <View style={styles.headerRow}>
          <Text style={[styles.headerCell, { width: 120 }]}>Ticker</Text>
          <Text style={[styles.headerCell, { width: 160 }]}>Amount (USD)</Text>
          <Text style={[styles.headerCell, { width: 120 }]}>% of AUM</Text>
          <Text style={[styles.headerCell, { width: 120 }]}>Recommended</Text>
        </View>
        {data.map((p, i) => (
          <View style={styles.row} key={String(i)}>
            <Text style={[styles.cell, { width: 120 }]}>{p?.ticker || ''}</Text>
            <Text style={[styles.cell, { width: 160 }]}>{formatCurrency(Number(p?.amount || 0))}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{formatPercent(Number(p?.pct || 0) * 100)}</Text>
            <Text style={[styles.cell, { width: 120 }]}>{p?.is_recommended ? 'Yes' : 'No'}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AdvisorPortfolioPDF({ data }) {
  const snapshotDate = data?.snapshotDate || null;
  const advisorId = data?.advisorId || '';
  return (
    <Document>
      <Page size="LETTER" orientation="landscape" style={styles.page}>
        <PageHeader snapshotDate={snapshotDate} />
        <View style={{ marginTop: 24 }}>
          <Text style={styles.title}>Advisor: {advisorId || 'N/A'}</Text>
          <Text style={styles.subText}>Portfolio summary for the selected snapshot</Text>
        </View>
        <KPISection data={data} />
        <AllocationTable rows={data?.portfolio?.allocation} />
        <PositionsTable rows={data?.portfolio?.positions} />
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
function formatPercent(v) {
  if (v == null || isNaN(v)) return '0%';
  const n = Number(v);
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}%`;
}

export default AdvisorPortfolioPDF;

