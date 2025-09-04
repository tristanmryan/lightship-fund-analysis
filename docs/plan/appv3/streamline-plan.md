# Lightship Fund Analytics v3 - Streamlined Architecture Plan

## Executive Summary

**Current State**: Feature-overloaded app with 8 tabs, 4+ duplicate table components, complex alerting system for 4 advisors, and disconnected holdings/trades/performance data.

**Target State**: Streamlined 5-tab app focused on recommended fund management, with unified components and properly connected data flows.

**Timeline**: 3 weeks (3 phases)

**Key Principle**: DELETE AGGRESSIVELY. If a feature isn't directly serving the core mission of managing the recommended fund list and tracking advisor portfolios, remove it.

## Core Architecture Changes

### Navigation Structure (5 Tabs + Admin)
```
📊 Dashboard     → Complete fund universe with scoring
📋 Recommended   → Dedicated recommended list by asset class (NEW)
💼 Portfolios    → Holdings analysis (merger of Advisors + Holdings features)
💹 Trading       → Simplified flows (stripped-down version)
📄 Reports       → Keep as-is
⚙️ Admin        → Keep as-is (hidden for non-admins)
```

### Components to DELETE Entirely
- [ ] Command Center tab and all alerting components
- [ ] Asset Classes tab (functionality moves to Recommended)
- [ ] Compare tab (becomes inline action)
- [ ] All duplicate fund table implementations
- [ ] Complex heatmaps and sentiment gauges
- [ ] ScoringTrends component (if not actively used)
- [ ] MetricExplanationPanel (unless actively used)

### Database/Services to Clean
- [ ] Remove alert_rules, alerts, alert_actions tables
- [ ] Remove all alert-related RPCs
- [ ] Clean up unused materialized views
- [ ] Remove alertsService.js

---

## Phase 1: Core Consolidation & Recommended Page (Week 1)

### Objectives
- Create unified table component to replace 4+ implementations
- Build new Recommended page with asset class grouping
- Connect holdings data to fund recommendations
- Remove Command Center entirely

### 1.1 Unified Table Component

**Create**: `src/components/common/UnifiedFundTable.jsx`

```javascript
// This single component replaces:
// - SimpleFundViews.jsx (DELETE after migration)
// - EnhancedFundTable.jsx (DELETE after migration)
// - ModernFundTable.jsx (DELETE after migration)
// - AssetClassTable.jsx (KEEP temporarily, special case)

// Unified column registry
const COLUMN_DEFINITIONS = {
  ticker: {
    label: 'Ticker',
    accessor: (row) => row.ticker || row.symbol || row.Symbol,
    width: '80px',
    sortable: true
  },
  name: {
    label: 'Fund Name',
    accessor: (row) => row.name || row.fund_name || row['Fund Name'],
    width: '200px',
    sortable: true
  },
  score: {
    label: 'Score',
    accessor: (row) => row.score || row.score_final || row.final_score || 0,
    width: '70px',
    sortable: true,
    render: (value) => <ScoreBadge score={value} />
  },
  // ... define ALL columns here with proper fallback chains
  firmAUM: {
    label: 'Firm AUM',
    accessor: (row) => row.firmAUM || 0,
    width: '100px',
    sortable: true,
    render: (value) => formatCurrency(value)
  },
  advisorCount: {
    label: '# Advisors',
    accessor: (row) => row.advisorCount || 0,
    width: '80px',
    sortable: true
  }
};
```

**Features to Include**:
- [ ] Single source of column definitions
- [ ] Configurable column sets (basic, extended, recommended)
- [ ] Single/multi-column sorting
- [ ] Export to CSV/Excel
- [ ] Row click handlers
- [ ] Benchmark row styling
- [ ] Loading states
- [ ] Empty states

**Migration Checklist**:
- [ ] Update Dashboard to use UnifiedFundTable
- [ ] Update all other fund table references
- [ ] Test all existing functionality works
- [ ] DELETE SimpleFundViews.jsx
- [ ] DELETE EnhancedFundTable.jsx
- [ ] DELETE ModernFundTable.jsx
- [ ] DELETE FundTableHeader.jsx
- [ ] DELETE FundTableRow.jsx

### 1.2 New Recommended Page

**Create**: `src/components/Recommended/RecommendedList.jsx`

```javascript
// Structure:
// - Asset class selector/filter
// - For each asset class:
//   - Clean table with recommended funds
//   - Benchmark as last row (visually distinct)
//   - Firm ownership metrics

const ASSET_CLASS_GROUPS = [
  'US Equity',
  'International Equity',
  'Fixed Income',
  'Commodities',
  'Alternatives'
];

// Each table shows:
// Ticker | Name | Score | YTD | 1Y | 3Y | Expense | Firm AUM | # Advisors | Action
```

**Data Integration**:
```javascript
// For each recommended fund, JOIN with holdings data:
SELECT 
  f.*,
  COALESCE(h.firm_aum, 0) as firm_aum,
  COALESCE(h.advisor_count, 0) as advisor_count,
  COALESCE(h.avg_position_size, 0) as avg_position_size
FROM funds f
LEFT JOIN (
  SELECT 
    ticker,
    SUM(market_value) as firm_aum,
    COUNT(DISTINCT advisor_id) as advisor_count,
    AVG(market_value) as avg_position_size
  FROM client_holdings
  WHERE snapshot_date = [latest]
  GROUP BY ticker
) h ON f.ticker = h.ticker
WHERE f.recommended = true
```

**Implementation Tasks**:
- [ ] Create RecommendedList component
- [ ] Add route /recommended
- [ ] Add navigation tab
- [ ] Create RPC get_recommended_funds_with_ownership()
- [ ] Add ownership data to fund service
- [ ] Style benchmark rows distinctly
- [ ] Add export by asset class
- [ ] Add "Add to Recommended" / "Remove from Recommended" actions

### 1.3 Remove Command Center

**Delete These Files**:
- [ ] src/components/CommandCenter/CommandCenter.jsx
- [ ] src/components/CommandCenter/RulesAdmin.jsx
- [ ] src/services/alertsService.js
- [ ] api/alerts/*
- [ ] Remove Command Center route from App.jsx
- [ ] Remove Command Center tab from navigation

**Database Cleanup**:
```sql
-- Run these migrations to remove alert system:
DROP TABLE IF EXISTS alert_actions CASCADE;
DROP TABLE IF EXISTS alerts CASCADE;
DROP TABLE IF EXISTS alert_rules CASCADE;
DROP FUNCTION IF EXISTS refresh_alerts_for_month CASCADE;
DROP FUNCTION IF EXISTS get_alerts CASCADE;
DROP FUNCTION IF EXISTS acknowledge_alert CASCADE;
DROP FUNCTION IF EXISTS resolve_alert CASCADE;
DROP FUNCTION IF EXISTS assign_alert CASCADE;
```

### 1.4 Connect Holdings to Funds

**Update**: `src/services/fundService.js`

```javascript
// Add method to get funds with ownership data
async function getFundsWithOwnership() {
  const funds = await getAllFunds();
  const ownership = await supabase.rpc('get_fund_ownership_summary');
  
  return funds.map(fund => ({
    ...fund,
    firmAUM: ownership[fund.ticker]?.firm_aum || 0,
    advisorCount: ownership[fund.ticker]?.advisor_count || 0,
    ownershipStatus: getOwnershipStatus(ownership[fund.ticker])
  }));
}

function getOwnershipStatus(ownership) {
  if (!ownership) return 'NOT_HELD';
  if (ownership.firm_aum > 500000) return 'WELL_OWNED';
  if (ownership.firm_aum > 100000) return 'MODERATELY_OWNED';
  return 'UNDER_OWNED';
}
```

### Phase 1 Acceptance Criteria
- [ ] Single UnifiedFundTable component working everywhere
- [ ] All old table components deleted
- [ ] Recommended page shows funds grouped by asset class
- [ ] Each recommended fund shows firm AUM and advisor count
- [ ] Command Center completely removed
- [ ] No console errors or warnings
- [ ] All existing functionality preserved

### Phase 1 Verification Checklist
- [ ] Can view all funds on Dashboard
- [ ] Can view recommended funds by asset class
- [ ] Can see which advisors own each fund
- [ ] Can export recommended list
- [ ] No duplicate table code remains
- [ ] Alert system fully removed from DB

---

## Phase 2: Simplify Portfolios & Trading (Week 2)

### 2.1 Merge Advisors into Portfolios

**Update**: Rename and enhance Advisors tab to Portfolios

**New Structure**:
```
Portfolios Tab
├── View Selector: [By Advisor | By Fund | Gap Analysis]
├── By Advisor View
│   ├── Advisor selector
│   ├── Holdings table
│   ├── Concentration alerts
│   └── Alignment score
├── By Fund View
│   ├── Fund selector (or click from Recommended)
│   ├── Which advisors hold it
│   ├── Total firm position
│   └── Recent trading activity
└── Gap Analysis View
    ├── Recommended funds not held
    ├── Under-owned recommended funds
    └── Non-recommended positions
```

**Implementation**:
- [ ] Rename src/components/Advisor to src/components/Portfolios
- [ ] Create view toggle (By Advisor / By Fund / Gaps)
- [ ] Add fund → advisor lookup
- [ ] Create gap analysis calculations
- [ ] Remove unnecessary complexity from PortfolioDashboard.jsx

### 2.2 Simplify Trading/Flows

**Keep ONLY**:
- Monthly net flows chart (simple)
- Top 10 movers table (in/out)
- Basic filters (month, asset class)

**DELETE**:
- [ ] Complex heatmaps
- [ ] Sentiment gauges
- [ ] Advisor participation details
- [ ] Pattern analysis
- [ ] Trend analytics beyond simple chart

**Simplify**: `src/components/Analytics/TradeFlowDashboard.jsx`
```javascript
// Reduce from 500+ lines to ~200 lines
// Just show:
// 1. Month selector
// 2. Net flow line chart
// 3. Two tables: Top Inflows | Top Outflows
// 4. Flag when selling recommended or buying non-recommended
```

### 2.3 Clean Up Navigation

**Update**: `src/App.jsx`

```javascript
const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'recommended', label: 'Recommended', icon: Star },
  { id: 'portfolios', label: 'Portfolios', icon: Briefcase },
  { id: 'trading', label: 'Trading', icon: TrendingUp },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'admin', label: 'Admin', icon: Settings, adminOnly: true }
];
```

**Remove**:
- [ ] Asset Classes tab
- [ ] Compare tab
- [ ] Command Center tab
- [ ] Flows tab (rename to Trading)
- [ ] Advisors tab (rename to Portfolios)

### Phase 2 Acceptance Criteria
- [ ] Portfolios page has 3 views (Advisor/Fund/Gaps)
- [ ] Can see any fund's ownership across advisors
- [ ] Trading page simplified to essentials
- [ ] Navigation reduced to 5 tabs + Admin
- [ ] No feature regressions

---

## Phase 3: Polish & Optimize (Week 3)

### 3.1 Performance Optimization

**Tasks**:
- [ ] Add React.memo to expensive components
- [ ] Implement virtual scrolling for large tables
- [ ] Add proper loading states everywhere
- [ ] Cache holdings data in service layer
- [ ] Optimize database queries with proper indexes

### 3.2 Enhanced Scoring Display

Since scoring is critical, enhance how it's shown:

- [ ] Add score trending indicators (↑↓→)
- [ ] Show score confidence based on data completeness
- [ ] Add tooltip with top 3 factors affecting score
- [ ] Create score history mini-chart

### 3.3 Code Cleanup

**Delete Unused Components**:
- [ ] src/components/Dashboard/ScoreAnalysisSection.jsx (if unused)
- [ ] src/components/Dashboard/MetricExplanationPanel.jsx (if unused)
- [ ] src/components/Dashboard/ScoreBreakdownChart.jsx (if unused)
- [ ] Any other orphaned components

**Clean Up Services**:
- [ ] Remove unused API endpoints
- [ ] Consolidate duplicate data fetching logic
- [ ] Remove unused utility functions

**Database Cleanup**:
- [ ] Drop unused materialized views
- [ ] Remove unused RPCs
- [ ] Clean up test data

### 3.4 Documentation Update

- [ ] Update README with new architecture
- [ ] Document unified table component API
- [ ] Create user guide for new Recommended page
- [ ] Archive old documentation

### Phase 3 Acceptance Criteria
- [ ] App loads in < 2 seconds
- [ ] All unused code removed
- [ ] Documentation updated
- [ ] No console warnings
- [ ] Clean build with no errors

---

## Implementation Instructions 

### Getting Started
1. Review this entire document
2. Check current branch and create new branch: `feature/appv3-streamline`
3. Start with Phase 1, Section 1.1 (Unified Table)
4. Work systematically through each checkbox
5. Test after each major change
6. Commit with clear messages: "appv3: [phase] - [what was done]"

### Guidelines
- **DELETE FIRST**: When replacing components, delete the old one immediately after confirming the new one works
- **NO HALF-MEASURES**: If we're removing a feature, remove it completely (component, service, database, routes)
- **TEST CONSTANTLY**: Run the app after each significant change
- **SIMPLIFY AGGRESSIVELY**: If you see complex code that could be simpler, make it simpler
- **MAINTAIN SCORING**: The scoring system is sacred - preserve all scoring functionality

### Progress Tracking
- Check off completed items with [x]
- Add notes in <!-- comments --> for important decisions
- If something can't be deleted yet, note why: <!-- BLOCKED: [reason] -->
- Update percentage complete at end of each section

### Communication
- If you encounter ambiguity, make a decision and note it
- If something will break existing functionality, note it and provide migration path
- Keep a running log of deleted files at the bottom of this document

---

## Deleted Files Log (Update as you go)

### Phase 1 Deletions
<!-- 
- CommandCenter.jsx - DELETED [date]
- alerts.js - DELETED [date]
- SimpleFundViews.jsx - DELETED [date]
etc...
-->

### Phase 2 Deletions
<!-- Track here -->

### Phase 3 Deletions
<!-- Track here -->

---

## Status Tracking

**Phase 1 Progress**: 0% Complete
**Phase 2 Progress**: 0% Complete  
**Phase 3 Progress**: 0% Complete

**Overall Progress**: 0% Complete

**Last Updated**: [Update this]
**Current Blockers**: None

---

## Quick Reference Commands

```bash
# Start development
npm start

# Run tests
npm test

# Check for unused dependencies
npm prune

# Build for production
npm run build

# Database migrations
cd supabase
npx supabase migration new remove_alerts
npx supabase db push
```

---

## Success Metrics

After completion, the app should:
1. Load 50% faster
2. Have 60% less code
3. Zero duplicate components
4. Clear information hierarchy
5. Advisors can answer: "What do we own?" "What should we own?" "What are we trading?"

---

## Notes Section (Add notes here)

<!-- Implementation notes will be added below this line -->
