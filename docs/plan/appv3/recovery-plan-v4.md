# Lightship Fund Analytics v4 - Professional Recovery Plan

## Executive Summary

**Current State Assessment**: The v3 streamline was mechanically executed without UX consideration. Core functionality is broken: tables don't scroll, scores show as 0, formatting is unprofessional, and the app doesn't help advisors answer basic questions about their business.

**Recovery Vision**: Build a professional, advisor-centric application that answers three fundamental questions:
1. **What should we recommend?** (scoring & analysis)
2. **What do we actually own?** (holdings & portfolios)  
3. **What are we trading?** (flows & activity)

**Timeline**: 3 phases over 4 weeks
- Phase 4A: Core Infrastructure Fix (Week 1)
- Phase 4B: Professional UX Rebuild (Week 2)
- Phase 4C: Polish & Integration (Weeks 3-4)

**Success Metrics**:
- Tables scroll and display all data properly
- Scores work everywhere
- Professional visual quality
- Advisors can answer key questions in < 3 clicks
- Data is accurate and properly formatted

---

## What Went Wrong (Candid Assessment)

### Technical Failures
1. **Over-abstracted table system** - DataTable with broken virtual scrolling for 149 funds
2. **Broken data pipeline** - Server-side scoring exists but isn't connected
3. **Missing integrations** - Holdings data not connected to fund recommendations
4. **Poor component architecture** - Complex hooks and wrappers instead of simple, working code

### UX Failures
1. **No visual hierarchy** - Everything looks the same, nothing stands out
2. **Poor formatting** - 3 decimal expenses, misaligned columns, inconsistent spacing
3. **Broken interactions** - Tooltips disappear, tables don't scroll, clicks don't work
4. **Missing context** - Advisor IDs instead of names, no benchmarks, scores show as 0

### Process Failures
1. **Mechanical execution** - Code was written without testing actual usage
2. **No visual polish** - Zero attention to professional appearance
3. **Feature removal without replacement** - Lost useful features while keeping broken ones

---

## Phase 4A: Core Infrastructure Fix (Week 1)

### Objective
Replace broken systems with simple, working implementations. No abstractions, just code that works.

### A1. New Simple Table System

**DELETE these files completely**:
```
- src/components/common/DataTable.jsx
- src/components/common/DataTable.css
- src/components/common/UnifiedFundTable.jsx
- src/hooks/useTableSort.js
- src/hooks/useTableFilter.js
- src/hooks/useTableSelection.js
- src/hooks/useTableExport.js
```

**CREATE: `src/components/tables/ProfessionalTable.jsx`**
```javascript
// Simple, professional table that JUST WORKS
export function ProfessionalTable({ 
  data, 
  columns, 
  onRowClick, 
  sortable = true,
  maxHeight = '600px' // Fixed, scrollable height
}) {
  const [sortConfig, setSortConfig] = useState({ key: 'score', direction: 'desc' });
  
  const sortedData = useMemo(() => {
    if (!sortable) return data;
    return [...data].sort((a, b) => {
      const aVal = columns.find(c => c.key === sortConfig.key)?.accessor(a) ?? 0;
      const bVal = columns.find(c => c.key === sortConfig.key)?.accessor(b) ?? 0;
      return sortConfig.direction === 'asc' 
        ? (aVal > bVal ? 1 : -1)
        : (bVal > aVal ? 1 : -1);
    });
  }, [data, sortConfig, columns, sortable]);

  return (
    <div className="professional-table-container">
      <table className="professional-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th 
                key={col.key}
                onClick={() => sortable && handleSort(col.key)}
                style={{ 
                  width: col.width,
                  textAlign: col.align || (col.numeric ? 'right' : 'left'),
                  cursor: sortable ? 'pointer' : 'default'
                }}
              >
                {col.label}
                {sortConfig.key === col.key && (
                  <span>{sortConfig.direction === 'asc' ? ' ↑' : ' ↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody style={{ maxHeight, overflowY: 'auto', display: 'block' }}>
          {sortedData.map((row, i) => (
            <tr 
              key={row.ticker || i}
              onClick={() => onRowClick?.(row)}
              className={row.is_benchmark ? 'benchmark-row' : ''}
            >
              {columns.map(col => (
                <td 
                  key={col.key}
                  style={{ 
                    width: col.width,
                    textAlign: col.align || (col.numeric ? 'right' : 'left')
                  }}
                >
                  {col.render ? col.render(col.accessor(row), row) : col.accessor(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**CSS: `src/components/tables/ProfessionalTable.css`**
```css
.professional-table-container {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
  background: white;
}

.professional-table {
  width: 100%;
  border-collapse: collapse;
}

.professional-table thead {
  background: #f9fafb;
  border-bottom: 2px solid #e5e7eb;
  position: sticky;
  top: 0;
  z-index: 10;
}

.professional-table th {
  padding: 12px;
  font-weight: 600;
  color: #111827;
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.05em;
}

.professional-table tbody {
  display: block;
  overflow-y: auto;
  width: 100%;
}

.professional-table tbody tr {
  display: table;
  width: 100%;
  table-layout: fixed;
}

.professional-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
}

.professional-table tbody tr:hover {
  background: #f9fafb;
  cursor: pointer;
}

.professional-table .benchmark-row {
  background: #f3f4f6;
  font-style: italic;
}
```

### A2. Fix Column Definitions

**UPDATE: `src/config/tableColumns.js`**

Remove the broken "rationale chips" from NAME_COLUMN:
```javascript
export const NAME_COLUMN = {
  key: 'name',
  label: 'Fund Name',
  accessor: (row) => row.name || row.fund_name || row['Fund Name'] || '',
  width: '250px',
  render: (value, fund) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ fontWeight: fund.recommended ? '500' : '400' }}>
        {value}
      </span>
      {fund.recommended && (
        <span style={{ color: '#eab308', fontSize: '12px' }}>★</span>
      )}
    </div>
  )
};

// Fix expense ratio to 2 decimals
export const EXPENSE_RATIO_COLUMN = {
  key: 'expenseRatio',
  label: 'Expense',
  accessor: (row) => row.expense_ratio ?? row['Net Expense Ratio'] ?? null,
  width: '80px',
  numeric: true,
  align: 'right',
  render: (value) => value !== null ? `${value.toFixed(2)}%` : '—'
};
```

### A3. Fix Data Pipeline

**UPDATE: `src/services/fundService.js`**

Connect server-side scoring properly:
```javascript
export async function getFundsWithOwnership(asOfDate = null) {
  try {
    // Get funds WITH SCORES from server
    const { data: funds, error: fundsError } = await supabase
      .rpc('get_funds_as_of', { 
        p_as_of_date: asOfDate || getCurrentMonth() 
      });
    
    if (fundsError) throw fundsError;
    
    // Get ownership data
    const { data: ownership, error: ownershipError } = await supabase
      .rpc('get_fund_ownership_summary', {
        p_snapshot_date: asOfDate || getCurrentMonth()
      });
    
    if (ownershipError) {
      console.warn('Ownership data not available:', ownershipError);
    }
    
    // Merge funds with ownership
    return funds.map(fund => ({
      ...fund,
      score: fund.score || fund.score_final || 0, // Ensure score exists
      firmAUM: ownership?.[fund.ticker]?.firm_aum || 0,
      advisorCount: ownership?.[fund.ticker]?.advisor_count || 0,
      avgPosition: ownership?.[fund.ticker]?.avg_position || 0
    }));
  } catch (error) {
    console.error('Error fetching funds with ownership:', error);
    throw error;
  }
}

export async function getRecommendedFundsWithOwnership(asOfDate = null) {
  const allFunds = await getFundsWithOwnership(asOfDate);
  // Include benchmarks but mark them
  return allFunds.filter(f => f.recommended || f.is_benchmark);
}
```

### A4. Create Advisor Name Mapping

**CREATE: `src/config/advisorNames.js`**
```javascript
// Advisor ID to Name mapping
export const ADVISOR_NAMES = {
  '2JKT': 'Scott',
  '2KCC': 'Scott',
  '2KCM': 'Evan',
  '2KDV': 'Evan',
  '2KFY': 'Evan',
  '2KGW': 'Ron',
  '2KYU': 'Evan',
  '70G5': 'Scott',
  '70WB': 'Evan',
  '70YN': 'Evan',
  '70YU': 'Scott',
  '2JTL': 'Jon',
  '2JUU': 'Jack',
  '2PLK': 'Scott',
  '2PN1': 'Scott',
  '2PNG': 'Scott',
  '70UG': 'Jack',
  '70UU': 'Jack',
  '71PD': 'Scott'
};

export function getAdvisorName(advisorId) {
  return ADVISOR_NAMES[advisorId] || advisorId;
}

export function getUniqueAdvisors() {
  const unique = new Set(Object.values(ADVISOR_NAMES));
  return Array.from(unique).sort(); // Returns ['Evan', 'Jack', 'Jon', 'Ron', 'Scott']
}

export function getAdvisorsByName(name) {
  return Object.entries(ADVISOR_NAMES)
    .filter(([id, advisorName]) => advisorName === name)
    .map(([id]) => id);
}

// Helper to get all IDs for selection dropdowns
export function getAdvisorOptions() {
  const advisorGroups = {};
  Object.entries(ADVISOR_NAMES).forEach(([id, name]) => {
    if (!advisorGroups[name]) {
      advisorGroups[name] = [];
    }
    advisorGroups[name].push(id);
  });
  
  // Return formatted for dropdowns
  return Object.entries(advisorGroups).map(([name, ids]) => ({
    label: name,
    value: ids[0], // Primary ID
    allIds: ids    // All IDs for this advisor
  }));
}
```

### Phase 4A Acceptance Criteria
- [ ] Tables scroll properly and show all rows
- [ ] Scores display correctly (not 0)
- [ ] Expense ratios show 2 decimals
- [ ] Fund names don't have weird icons underneath
- [ ] Advisor names appear instead of IDs
- [ ] Data loads from server-side scoring

### Phase 4A Implementation Checklist
- [ ] Delete all DataTable-related files
- [ ] Create ProfessionalTable component
- [ ] Fix column definitions (remove rationale chips)
- [ ] Fix fundService to use server RPCs properly
- [ ] Create advisor name mapping
- [ ] Update Dashboard to use ProfessionalTable
- [ ] Test scrolling with all 149 funds
- [ ] Verify scores are not 0

---

## Phase 4B: Professional UX Rebuild (Week 2)

### Objective
Rebuild each tab to actually help advisors do their job, with professional visual design.

### B1. Dashboard as True Homepage

**REDESIGN: `src/components/Dashboard/Dashboard.jsx`**

```javascript
export function Dashboard() {
  const [funds, setFunds] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedMetric, setSelectedMetric] = useState('score');
  
  useEffect(() => {
    loadDashboardData();
  }, []);
  
  return (
    <div className="dashboard">
      {/* Hero KPIs - What matters most */}
      <div className="kpi-section">
        <KPICard 
          label="Total AUM" 
          value={summary?.totalAUM} 
          format="currency"
        />
        <KPICard 
          label="Funds Tracked" 
          value={summary?.totalFunds}
          subtext={`${summary?.recommendedCount} recommended`}
        />
        <KPICard 
          label="Avg Score" 
          value={summary?.avgScore} 
          format="score"
          trend={summary?.scoreChange}
        />
        <KPICard 
          label="Net Flows" 
          value={summary?.monthlyFlows} 
          format="currency"
          trend="positive"
        />
      </div>

      {/* Quick Insights - What needs attention */}
      <div className="insights-row">
        <InsightCard title="Top Performers">
          {/* Top 5 funds by selected metric */}
        </InsightCard>
        <InsightCard title="Needs Review">
          {/* Funds with declining scores */}
        </InsightCard>
        <InsightCard title="New Recommendations">
          {/* Recently added to rec list */}
        </InsightCard>
      </div>

      {/* Main Table - All funds with key metrics */}
      <div className="main-table-section">
        <div className="table-header">
          <h2>Fund Universe</h2>
          <div className="table-controls">
            <MetricSelector value={selectedMetric} onChange={setSelectedMetric} />
            <ExportButton data={funds} />
          </div>
        </div>
        
        <ProfessionalTable
          data={funds}
          columns={DASHBOARD_COLUMNS}
          onRowClick={(fund) => navigateToFundDetail(fund)}
        />
      </div>
    </div>
  );
}
```

### B2. Recommended Page That Works

**REBUILD: `src/components/Recommended/RecommendedList.jsx`**

```javascript
export function RecommendedList() {
  const [fundsByClass, setFundsByClass] = useState({});
  const [selectedClass, setSelectedClass] = useState('all');
  
  const ASSET_CLASSES = [
    'US Equity',
    'International Equity',  
    'Fixed Income',
    'Alternatives',
    'Commodities'
  ];
  
  return (
    <div className="recommended-page">
      <div className="page-header">
        <h1>Recommended Funds</h1>
        <p className="subtitle">
          {getTotalRecommended()} funds across {ASSET_CLASSES.length} asset classes
        </p>
      </div>

      {/* Asset Class Filter */}
      <div className="filter-row">
        <AssetClassTabs
          classes={['All', ...ASSET_CLASSES]}
          selected={selectedClass}
          onChange={setSelectedClass}
        />
        <ExportButton 
          data={getFilteredFunds()} 
          filename="recommended_funds"
        />
      </div>

      {/* Tables by Asset Class */}
      {selectedClass === 'all' ? (
        ASSET_CLASSES.map(assetClass => (
          <div key={assetClass} className="asset-class-section">
            <h3 className="section-title">
              {assetClass}
              <span className="count">
                {fundsByClass[assetClass]?.length || 0} funds
              </span>
            </h3>
            
            <ProfessionalTable
              data={[
                ...fundsByClass[assetClass].funds,
                fundsByClass[assetClass].benchmark // Benchmark at bottom
              ]}
              columns={RECOMMENDED_COLUMNS}
              onRowClick={handleFundClick}
            />
          </div>
        ))
      ) : (
        <ProfessionalTable
          data={fundsByClass[selectedClass]}
          columns={RECOMMENDED_COLUMNS}
        />
      )}
    </div>
  );
}

// Column set for recommended page
const RECOMMENDED_COLUMNS = [
  { key: 'ticker', label: 'Ticker', width: '80px' },
  { key: 'name', label: 'Fund Name', width: '250px' },
  { key: 'score', label: 'Score', width: '70px', numeric: true },
  { key: 'ytdReturn', label: 'YTD', width: '80px', numeric: true },
  { key: 'oneYear', label: '1Y', width: '80px', numeric: true },
  { key: 'threeYear', label: '3Y', width: '80px', numeric: true },
  { key: 'expense', label: 'Expense', width: '80px', numeric: true },
  { key: 'firmAUM', label: 'Firm AUM', width: '120px', numeric: true },
  { key: 'advisors', label: '# Advisors', width: '100px', numeric: true }
];
```

### B3. Portfolios Page That Makes Sense

**REBUILD: `src/components/Portfolios/Portfolios.jsx`**

```javascript
export function Portfolios() {
  const [view, setView] = useState('advisor'); // 'advisor', 'fund', 'gaps'
  const [selectedAdvisor, setSelectedAdvisor] = useState('');
  const [selectedFund, setSelectedFund] = useState('');
  
  return (
    <div className="portfolios-page">
      {/* View Toggle */}
      <ViewToggle
        options={[
          { value: 'advisor', label: 'By Advisor', icon: User },
          { value: 'fund', label: 'By Fund', icon: DollarSign },
          { value: 'gaps', label: 'Gap Analysis', icon: AlertTriangle }
        ]}
        value={view}
        onChange={setView}
      />

      {view === 'advisor' && (
        <AdvisorView>
          {/* Advisor selector WITH NAMES */}
          <AdvisorSelector
            value={selectedAdvisor}
            onChange={setSelectedAdvisor}
            options={getUniqueAdvisors().map(name => ({
              value: name,
              label: name
            }))}
          />
          
          {/* Visual summary cards */}
          <div className="advisor-summary">
            <SummaryCard label="Total AUM" value={advisorAUM} />
            <SummaryCard label="Holdings" value={holdingsCount} />
            <SummaryCard label="% in Recommended" value={alignmentScore} />
            <SummaryCard label="Top Position" value={topHolding} />
          </div>
          
          {/* Allocation chart */}
          <AllocationPieChart data={allocation} />
          
          {/* Holdings table */}
          <ProfessionalTable
            data={holdings}
            columns={HOLDINGS_COLUMNS}
          />
        </AdvisorView>
      )}

      {view === 'fund' && (
        <FundView>
          {/* Show which advisors own any fund */}
          <FundSelector
            value={selectedFund}
            onChange={setSelectedFund}
          />
          
          <div className="fund-ownership">
            <h3>Ownership Summary</h3>
            <OwnershipChart advisors={fundOwners} />
            <ProfessionalTable
              data={fundOwners}
              columns={OWNERSHIP_COLUMNS}
            />
          </div>
        </FundView>
      )}

      {view === 'gaps' && (
        <GapAnalysisView>
          {/* Clear sections */}
          <div className="gap-section">
            <h3>Recommended Funds We Don't Own</h3>
            <ProfessionalTable data={notOwned} columns={GAP_COLUMNS} />
          </div>
          
          <div className="gap-section">
            <h3>Under-Owned Recommended Funds</h3>
            <ProfessionalTable data={underOwned} columns={GAP_COLUMNS} />
          </div>
          
          <div className="gap-section">
            <h3>Non-Recommended Holdings</h3>
            <ProfessionalTable data={nonRecommended} columns={GAP_COLUMNS} />
          </div>
        </GapAnalysisView>
      )}
    </div>
  );
}
```

### B4. Trading Page With Clear Insights

**REBUILD: `src/components/Trading/Trading.jsx`**

```javascript
export function Trading() {
  const [advisor, setAdvisor] = useState('all');
  const [timeframe, setTimeframe] = useState('3M'); // 3M, 12M
  const [data, setData] = useState(null);
  
  return (
    <div className="trading-page">
      <div className="page-header">
        <h1>Trading Activity</h1>
        <div className="filters">
          <AdvisorSelector
            value={advisor}
            onChange={setAdvisor}
            includeAll={true}
          />
          <TimeframeToggle
            value={timeframe}
            onChange={setTimeframe}
            options={['3M', '12M']}
          />
        </div>
      </div>

      {/* Key Alerts */}
      <AlertsSection>
        {data?.alerts?.map(alert => (
          <Alert
            key={alert.id}
            type={alert.type}
            message={alert.message}
            // e.g., "John is buying non-recommended fund XYZ"
            // e.g., "Sarah sold recommended fund ABC"
          />
        ))}
      </AlertsSection>

      {/* Trading Summary */}
      <div className="trading-grid">
        <div className="trading-card">
          <h3>Top Buys</h3>
          <ProfessionalTable
            data={data?.topBuys}
            columns={[
              { key: 'ticker', label: 'Ticker' },
              { key: 'name', label: 'Fund' },
              { key: 'amount', label: 'Total Bought', numeric: true },
              { key: 'advisorCount', label: '# Advisors', numeric: true }
            ]}
          />
        </div>

        <div className="trading-card">
          <h3>Top Sells</h3>
          <ProfessionalTable
            data={data?.topSells}
            columns={[
              { key: 'ticker', label: 'Ticker' },
              { key: 'name', label: 'Fund' },
              { key: 'amount', label: 'Total Sold', numeric: true },
              { key: 'advisorCount', label: '# Advisors', numeric: true }
            ]}
          />
        </div>
      </div>

      {/* Net Flows Chart */}
      <div className="chart-section">
        <h3>Net Flows Trend</h3>
        <SimpleLineChart
          data={data?.flowTrend}
          xKey="month"
          yKey="netFlow"
          height={300}
        />
      </div>
    </div>
  );
}
```

### Phase 4B Acceptance Criteria
- [ ] Dashboard shows meaningful KPIs and insights
- [ ] Recommended page groups by asset class with benchmarks
- [ ] Portfolios page uses advisor names, not IDs
- [ ] Trading page highlights actionable insights
- [ ] All pages look professional with proper spacing
- [ ] Visual hierarchy guides user attention

---

## Phase 4C: Polish & Integration (Weeks 3-4)

### Objective
Final polish to make the app truly professional and ensure everything works together seamlessly.

### C1. Visual Polish Standards

**CREATE: `src/styles/professional.css`**
```css
/* Typography Scale */
.heading-xl { font-size: 24px; font-weight: 600; color: #111827; }
.heading-lg { font-size: 20px; font-weight: 600; color: #111827; }
.heading-md { font-size: 16px; font-weight: 600; color: #374151; }
.text-base { font-size: 14px; color: #4b5563; }
.text-sm { font-size: 12px; color: #6b7280; }

/* Number Formatting */
.number { font-variant-numeric: tabular-nums; }
.currency::before { content: '$'; }
.percent::after { content: '%'; }
.score-high { color: #059669; font-weight: 600; }
.score-med { color: #d97706; font-weight: 600; }
.score-low { color: #dc2626; font-weight: 600; }

/* Card Styles */
.kpi-card {
  background: white;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.kpi-card:hover {
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transform: translateY(-2px);
  transition: all 0.2s;
}

/* Status Indicators */
.status-recommended {
  background: #fef3c7;
  color: #92400e;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
}

.benchmark-indicator {
  color: #6b7280;
  font-style: italic;
  font-size: 12px;
}
```

### C2. Enhanced Score Tooltips

**UPDATE: `src/components/Dashboard/ScoreTooltip.jsx`**
```javascript
export function ScoreTooltip({ fund, trigger, children }) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef(null);
  
  // Keep tooltip open when hovering over it
  const handleMouseEnter = () => {
    clearTimeout(timeoutRef.current);
    setIsOpen(true);
  };
  
  const handleMouseLeave = () => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 200); // Small delay to allow moving to tooltip
  };
  
  return (
    <Tooltip
      content={
        <div 
          className="score-tooltip-content"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="tooltip-header">
            <h4>{fund.ticker} - Score Breakdown</h4>
            <div className="score-badge">{fund.score}</div>
          </div>
          
          <div className="tooltip-metrics">
            <h5>Key Factors:</h5>
            {getTopFactors(fund).map(factor => (
              <div key={factor.metric} className="factor-row">
                <span className="factor-name">{factor.name}</span>
                <span className={`factor-impact ${factor.impact > 0 ? 'positive' : 'negative'}`}>
                  {factor.impact > 0 ? '+' : ''}{factor.impact}
                </span>
              </div>
            ))}
          </div>
          
          <div className="tooltip-confidence">
            Data Confidence: {getConfidenceLevel(fund)}
          </div>
        </div>
      }
      visible={isOpen}
      onVisibleChange={setIsOpen}
      placement="right"
      interactive={true}
      delay={[200, 0]}
    >
      <div onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
        {children || <span className="score-value">{fund.score}</span>}
      </div>
    </Tooltip>
  );
}
```

### C3. Data Quality Improvements

**CREATE: `src/utils/formatters.js`**
```javascript
// Consistent formatting throughout the app
export const formatters = {
  currency: (value) => {
    if (value === null || value === undefined) return '—';
    const absValue = Math.abs(value);
    if (absValue >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
    if (absValue >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
    if (absValue >= 1e3) return `$${(value / 1e3).toFixed(1)}K`;
    return `$${value.toFixed(0)}`;
  },
  
  percent: (value, decimals = 1) => {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(decimals)}%`;
  },
  
  score: (value) => {
    if (!value) return '—';
    return value.toFixed(0);
  },
  
  expense: (value) => {
    if (value === null || value === undefined) return '—';
    return `${value.toFixed(2)}%`; // Always 2 decimals for expenses
  }
};
```

### C4. Testing & Verification

**CREATE: `docs/qa-checklist-v4.md`**
```markdown
## QA Checklist - v4 Recovery

### Tables
- [ ] All tables scroll to show all data
- [ ] Headers stay fixed when scrolling
- [ ] Sorting works on all numeric columns
- [ ] Benchmarks appear with distinct styling
- [ ] Hover states work properly

### Data Accuracy
- [ ] Scores display correctly (not 0)
- [ ] Expense ratios show 2 decimals
- [ ] AUM values are formatted properly
- [ ] Advisor names appear, not IDs
- [ ] Benchmarks included in recommended lists

### Visual Quality
- [ ] Consistent spacing throughout
- [ ] Numbers right-aligned in columns
- [ ] Professional typography scale
- [ ] Clear visual hierarchy
- [ ] Responsive on different screen sizes

### Interactions
- [ ] Tooltips stay open when hovering
- [ ] Row clicks navigate properly
- [ ] Filters update data immediately
- [ ] Exports work for all tables
- [ ] No console errors

### Business Logic
- [ ] Dashboard KPIs are accurate
- [ ] Recommended funds grouped by asset class
- [ ] Gap analysis identifies correct funds
- [ ] Trading alerts highlight issues
- [ ] Portfolios show correct ownership
```

### Phase 4C Acceptance Criteria
- [ ] All formatting is consistent and professional
- [ ] Tooltips work properly and don't disappear
- [ ] Visual hierarchy is clear
- [ ] All data is accurate
- [ ] App passes complete QA checklist
- [ ] Performance is fast (< 2s load time)

---

## Implementation Strategy

### DO NOT
- Try to fix the existing DataTable abstraction
- Add more complexity to "solve" problems
- Use virtual scrolling for 149 funds
- Create generic solutions for specific problems
- Ship without testing with real data

### DO
- Build simple, specific components
- Test every change with real data
- Focus on visual polish
- Use hardcoded solutions where appropriate
- Prioritize working code over "clean" code

### Daily Workflow
1. Morning: Review what's broken
2. Build: Create simple solution
3. Test: Verify with real data
4. Polish: Make it look professional
5. Commit: Clear message about what was fixed

---

## Success Metrics

After completion, the app will:

### Functionality
✅ Tables scroll and display all data  
✅ Scores work everywhere  
✅ Data pipeline connected properly  
✅ Advisor names instead of IDs  
✅ Benchmarks included appropriately  

### Visual Quality
✅ Professional typography and spacing  
✅ Clear visual hierarchy  
✅ Consistent formatting (2 decimal expenses)  
✅ Aligned columns  
✅ Distinct benchmark styling  

### User Experience
✅ Advisors can find what they need quickly  
✅ Tooltips that don't disappear  
✅ Clear insights on each page  
✅ Actionable alerts in trading  
✅ Meaningful dashboard KPIs  

### Performance
✅ < 2 second load times  
✅ Smooth scrolling  
✅ Responsive interactions  
✅ No console errors  

---

## Risk Mitigation

### Potential Issues & Solutions

**Issue**: Complex DataTable is deeply integrated  
**Solution**: Replace one page at a time, keep old code until new works

**Issue**: Server-side scoring might have bugs  
**Solution**: Add fallback to client-side calculation if server returns 0s

**Issue**: Advisor name mapping might be incomplete  
**Solution**: Show ID if name not found, add names as discovered

**Issue**: Visual changes might break tests  
**Solution**: Update tests after visual changes are confirmed good

---

## Communication Script for Implementation

When giving this plan to Claude Code or another implementer:

```
I need you to implement Phase 4A of our recovery plan. The current app has critical issues:
1. Tables don't scroll - only show 7 rows
2. Scores display as 0
3. Fund names have broken icons underneath
4. Overall visual quality is poor

Phase 4A focuses on core infrastructure fixes:
1. DELETE the entire DataTable system (it's broken beyond repair)
2. CREATE a simple ProfessionalTable that just works
3. FIX column definitions to remove broken features
4. CONNECT server-side scoring properly
5. ADD advisor name mapping

Read the full plan in docs/plan/appv4/recovery-plan.md
Start with A1 (New Simple Table System)
Test with real data after each change
Commit with clear messages

The goal is simple, working code - not abstractions.
```

---

## Appendix: Quick Fixes

If you need immediate relief while planning the full recovery:

### Fix Table Scrolling (1 minute)
```javascript
// In DataTable.jsx, find the height calculation and replace with:
const tableHeight = '600px'; // Just make it fixed
```

### Fix Scores Showing 0 (5 minutes)
```javascript
// In fundService.js, add fallback:
score: fund.score || fund.score_final || fund.final_score || 
       calculateScoreLocally(fund) || 0
```

### Fix Expense Ratio Decimals (1 minute)
```javascript
// In tableColumns.js, find expense ratio renderer:
render: (value) => value ? `${value.toFixed(2)}%` : '—'
```

### Remove Broken Icons from Names (2 minutes)
```javascript
// In tableColumns.js, remove the entire rationale chips section from NAME_COLUMN
```

---

## Notes

This plan prioritizes:
1. **Working code** over clean abstractions
2. **Visual quality** as equal to functionality  
3. **Simplicity** over flexibility
4. **Testing with real data** at every step
5. **Clear communication** about what's being fixed

The v3 streamline failed because it prioritized code organization over user experience. This recovery plan puts the advisor's needs first and builds the simplest possible solution that meets those needs professionally.

Remember: **The app's job is to help advisors manage investments, not showcase React patterns.**
