# Lightship Fund Analytics Enhancement Plan
## From Research Tool to Advisor Intelligence Platform

### Project Vision
Transform the existing fund analytics application into a comprehensive advisor intelligence platform that connects fund research with actual advisor activity, client portfolios, and business outcomes.

### Executive Summary
- **Current State**: Production-ready fund analytics with ~150 funds, Z-score scoring, and PDF reporting
- **Target State**: Advisor intelligence platform with holdings analytics, trade flow intelligence, and unified advisor insights
- **Timeline**: 8 weeks end-to-end (phased rollout behind feature flags)
- **Impact**: Higher advisor value through actionable, explainable insights; no client PII exposed
### Execution Tracker (Living)
- [x] Phase 1: DB tables (`client_holdings`, `trade_activity`) + indexes
- [x] Phase 1: Materialized views (`advisor_metrics_mv`, `fund_flows_mv`)
- [x] Phase 1: CSV ingestion (holdings, trades) with validation + hashing (endpoints + UI)
- [x] Phase 1: RPCs for refresh + retrieval; serverless endpoints
- [x] Phase 2: Advisor portfolio dashboard + utilization analytics (exports, deep link, adoption trend)
- [ ] Phase 3: Trade flow dashboard + sentiment/patterns
- [ ] Phase 4: Command center integration + alerts

### Project Tracking (Living)
- Status: Planning resumed after IDE crash; no code changes applied.

#### Progress Notes
- 2025-09-02: Added Phase 1 SQL migration for holdings/trades (supabase/migrations/20250829_holdings_trades_foundation.sql).
- 2025-09-02: Added MV refresh controls in Admin and local row-level error reporting + downloadable error reports in imports.
  - Added serverless import endpoints: api/import/holdings.js, api/import/trades.js (with dry-run).
  - Implemented Admin UI for holdings/trades import with EOM validation, previews, progress, and confirmation view.
  - Surfaced advisor AUM and flows KPIs on dashboard (reads MVs).
  - Cleaned plan placeholders and confirmed RJ mappings (ignoring discretionary/time-price).
- Current focus: Confirm CSV field mappings from RJ samples and finalize Phase 1 data validations + privacy approach.
- Immediate owners: Data ingestion & schema (Codex), RJ export verification (Tristan).
  - Near-term milestone: Phase 1 design freeze for schema + import validations.
\- 2025-09-02: Phase 2 kickoff – Implemented Advisor Portfolio Dashboard (UI + data hooks).
  - New service: src/services/advisorService.js (dates, advisors, metrics RPC, holdings aggregation, allocation, concentration, adoption).
  - New component: src/components/Advisor/PortfolioDashboard.jsx (date/advisor selectors; AUM, holdings, clients, % in recommended; allocation table; concentration alerts; gap analysis basics).
  - App navigation: Added “Advisors” tab and route wiring in src/App.jsx.
  - Computation: Keeps heavy lifting in DB MVs/RPCs; performs advisor-level aggregation client-side for selected snapshot (tested for 25K snapshot scale).
  - No PII exposed; only advisor_id and aggregated holdings used.
  - Build hardening: Removed browser import of Node 'crypto' by splitting server/client import utilities; hashing remains server-only per security policy.
    - Server RPCs added for pre-aggregation: supabase/migrations/20250902_advisor_portfolio_rpcs.sql
      - get_advisor_portfolio_allocation(p_date, p_advisor_id)
      - get_advisor_positions(p_date, p_advisor_id, p_limit)
      - UI prefers RPCs; falls back to client aggregation if unavailable.
    - Exports: Added CSV and PDF exports for Advisor Portfolio dashboard using exportService (CSV builder + jsPDF/autoTable PDF).
    - Deep link: Import Confirmation now provides a one-click deep link into Advisors (preselects latest snapshot + top advisor via localStorage + NAVIGATE_APP).
    - Fund Utilization Analytics:
      - MV + RPCs: supabase/migrations/20250902_fund_utilization_mv.sql (fund_utilization_mv + get_fund_utilization + get_fund_adoption_trend + refresh function).
      - Service: src/services/utilizationService.js (dates, utilization, trend).
      - UI: src/components/Advisor/FundUtilization.jsx (bubble chart AUM vs advisors, ranking table, adoption trend line, asset class heatmap). Embedded under PortfolioDashboard.
      - Enhancements: search, min-advisors filter, client-side pagination, and CSV export for current view.
      - Refresh: api/import/holdings.js now refreshes fund_utilization_mv on import completion.
    - Advisor Adoption Trend:
      - MV + RPCs: supabase/migrations/20250902_advisor_adoption_mv.sql (advisor_adoption_mv + get_advisor_adoption_trend + refresh function).
      - Service: getAdvisorAdoptionTrend in src/services/advisorService.js.
      - UI: AdoptionTrendChart in src/components/Advisor/PortfolioDashboard.jsx.
    - Advisor Portfolio Exports:
      - Added Excel export: exportAdvisorPortfolioExcel in src/services/exportService.js and UI button in PortfolioDashboard.
\- 2025-09-02: Scope update – Defer Sector Exposure analytics.
  - Sector exposure mapping (equities/funds) and sector-based risk views are deferred to a later phase.
  - Phase 2 continues using current holdings/trades datasets without sector enrichment.
  - Optional “Style Exposure” via M* Category may be considered post-Phase 2.

#### Milestones
- [ ] Confirm RJ CSV headers -> DB columns mapping (holdings, trades)
- [ ] Define hashing method for `client_id` (salted HMAC; server-side secret)
- [ ] Document validation/normalization rules (dates, currency, negatives, cash rows)
- [ ] Finalize Phase 1 schema (tables + indexes) � ready for migration
- [ ] Define Phase 1 RPC surfaces and materialized views to refresh
- [ ] Security checklist (RLS, roles, secrets handling, audit entries)

#### Decision Log
- 2025-08-29: Use RJ sample CSV headers as source of truth for mappings; preserve generic mapping for future providers.
- 2025-08-29: Hash `client_id` using HMAC-SHA256 with server-side secret; never store source account numbers.
- 2025-08-29: Treat cash-only rows as non-holdings for utilization/flow analytics; may aggregate into "Cash" exposure metrics.

#### Open Questions
- Are there any RJ-provided APIs to replace or complement CSV? If yes, authentication/limits?
- Should we track discretionary flags and time-price discretion for compliance analytics (Phase 3+)?
- Do we need account-type level segmentation (e.g., IRA vs brokerage) for analytics v1?

---

## Phase 1: Data Infrastructure Foundation (Weeks 1-2)

### Database Schema Extensions

#### Tables (Phase 1)
```sql
-- Holdings snapshot (EOM normalized; client_id hashed from source account)
CREATE TABLE IF NOT EXISTS client_holdings (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date       date        NOT NULL,
  advisor_id          text        NOT NULL,
  client_id           text        NOT NULL, -- hashed
  account_source      text        NULL,     -- raw Account # for audit (hashed at ingest; optional)
  ticker              text        NOT NULL,
  cusip               text        NULL,
  quantity            numeric(20,6) NOT NULL,
  market_value        numeric(20,2) NOT NULL,
  created_at          timestamptz  NOT NULL DEFAULT now(),
  UNIQUE (snapshot_date, advisor_id, client_id, ticker)
);

-- Trade activity (raw trade feed normalized)
CREATE TABLE IF NOT EXISTS trade_activity (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_date          date        NOT NULL,
  settlement_date     date        NULL,
  advisor_id          text        NOT NULL,
  client_id           text        NOT NULL, -- hashed
  account_source      text        NULL,     -- raw Account for audit (hashed at ingest; optional)
  external_trade_id   text        NULL,     -- Trade Number for dedupe
  ticker              text        NULL,
  cusip               text        NULL,
  trade_type          text        NOT NULL CHECK (trade_type IN ('BUY','SELL')),
  product_type        text        NULL,
  quantity            numeric(20,6) NULL,
  principal_amount    numeric(20,2) NULL,
  cancelled           boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Indexes (performance)
CREATE INDEX IF NOT EXISTS idx_client_holdings_date ON client_holdings (snapshot_date);
CREATE INDEX IF NOT EXISTS idx_client_holdings_advisor ON client_holdings (advisor_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_trade_activity_date ON trade_activity (trade_date);
CREATE INDEX IF NOT EXISTS idx_trade_activity_advisor ON trade_activity (advisor_id, trade_date);
```

#### Deferred (Post‑Phase 1)
- `advisor_preferences` (custom benchmarks/alerts) to be designed from real usage.

#### Materialized Views for Performance
```sql
advisor_metrics_mv:
  - Real-time AUM by advisor
  - Client count and concentration
  - Recommendation adoption rates

fund_flows_mv:
  - Monthly inflows/outflows by fund
  - Advisor sentiment indicators
  - Net flow trends

portfolio_analytics_mv:
  - Aggregate exposures by asset class
  - Concentration risk scores
  - Deviation from model portfolios
```

### Data Import Pipeline

#### CSV Processing Requirements
1. **Holdings Data**
   - Monthly snapshots (25,000+ rows)
   - Required fields: advisor_id, client_account, ticker, quantity, market_value
   - Processing: Client ID hashing, ticker normalization, validation
   - Storage: Partitioned by snapshot_date for performance

2. **Trade Data**
   - Monthly exports (variable volume)
   - Required fields: trade_date, advisor_id, ticker, side, quantity, principal
   - Processing: Transaction classification, net flow calculation
   - Storage: Indexed by ticker and advisor for fast queries

#### Automation Strategy
```javascript
// Scheduled import jobs
- Daily: Check for new data files
- Weekly: Refresh materialized views
- Monthly: Generate trend reports
- Real-time: Process manual uploads
```

### Acceptance Criteria - Phase 1
- [ ] Database schema deployed with proper indexes
- [ ] CSV import handles 25K rows in <10 seconds
- [ ] Data validation catches 100% of format errors
- [ ] Materialized views refresh in <30 seconds
- [ ] Privacy compliance verified (client ID hashing)

---

## Phase 2: Holdings Intelligence (Weeks 3-4)

### Advisor Portfolio Dashboard

#### Core Features
1. **Portfolio Overview**
   - Total AUM across all clients
   - Number of unique holdings
   - Asset allocation breakdown
   - Concentration risk indicators

2. **Recommendation Adoption**
   - % of AUM in recommended funds
   - Gap analysis vs. recommended list
   - Funds held but not recommended
   - Implementation tracking over time

3. **Risk Analytics** (Adjusted Scope)
  - Concentration alerts (>10% in single position)
  - Sector exposure analysis — Deferred
  - Correlation risk assessment — Deferred
  - Deviation from target allocations — Deferred

#### UI Components
```javascript
<AdvisorDashboard>
  <PortfolioMetrics />
  <HoldingsHeatmap />
  <RecommendationGapAnalysis />
  <ConcentrationAlerts />
  <ActionableInsights />
</AdvisorDashboard>
```

### Fund Utilization Analytics

#### Metrics to Track
- Funds by total AUM across firm
- Funds by number of advisors using
- Average position size by fund
- Trending adoption (growing/shrinking)

#### Visualizations
- Bubble chart: AUM vs. # of advisors
- Time series: Fund adoption over time
- Heatmap: Fund usage by asset class
- Ranking table: Top/bottom utilized funds

### Acceptance Criteria - Phase 2
- [ ] Dashboard loads in <3 seconds with 25K holdings (instrumented; validate with prod-like dataset)
- [x] Recommendation gap analysis implemented (logic validated; verify with dataset)
- [x] Concentration alerts trigger on load and post-import (MV refresh wired)
- [x] Export holdings analysis to PDF/Excel/CSV (Advisor + Utilization)
- [x] Mobile-responsive design for tablets (responsive grids; charts scale via viewBox)

### Phase 2 Verification Checklist
- [ ] Import sample holdings and trades (Admin → Data Uploads)
- [ ] Click Refresh in Import Confirmation; verify advisors + flows populate
- [ ] Use deep-link button to open Advisors (preselected date/advisor)
- [ ] In Advisors:
  - [ ] KPIs show AUM, Unique Holdings, Clients, % in Recommended
  - [ ] Allocation, Concentration Alerts render
  - [ ] Adoption Trend shows recent months
  - [ ] Utilization shows bubbles, ranking, trend, heatmap; search/pagination work
  - [ ] CSV/PDF/Excel exports download and open successfully
  - [ ] On tablet width, grids stack cleanly; charts resize within container

### Deferred Items (Post-Phase 2)
- Sector exposure analytics (data model, ingestion, and advisor breakdowns)
- Correlation risk assessment and target allocation drift

---

## Phase 3: Trade Flow Intelligence (Weeks 5-6)

### Trade Analytics Dashboard

#### Flow Analysis Features
1. **Fund Level Flows**
   - Monthly/quarterly net flows
   - Inflow vs. outflow trends
   - Advisor participation rates
   - Average trade sizes

2. **Advisor Activity**
   - Most active traders
   - Systematic rebalancers
   - New fund adopters
   - Redemption patterns

3. **Sentiment Indicators**
   - Buy/sell pressure by fund
   - Advisor consensus movements
   - Early trend identification
   - Momentum scoring

#### Implementation Components
```javascript
<TradeFlowDashboard>
  <NetFlowChart period="6M" />
  <AdvisorSentimentGauge />
  <TopMovers direction="both" />
  <FlowHeatmap byAssetClass />
  <TradingPatternAnalysis />
</TradeFlowDashboard>
```

### Predictive Analytics

#### Early Warning System
- Identify funds losing advisor support
- Detect shift in asset class preferences
- Flag unusual trading patterns
- Predict rebalancing needs

#### Opportunity Identification
- Underutilized recommended funds
- Cross-sell opportunities
- Rebalancing candidates
- Tax loss harvesting options

### Acceptance Criteria - Phase 3
- [ ] Trade data imports process 10K trades in <5 seconds
- [ ] Flow calculations accurate to penny level
- [ ] Sentiment indicators update real-time
- [ ] Pattern detection catches 90% of trends
- [ ] Alerts delivered within 5 minutes of triggers

---

## Phase 4: Unified Intelligence Platform (Weeks 7-8)

### Advisor Command Center

#### Daily Workflow Integration
1. **Morning Dashboard**
   - Overnight market impacts on portfolios
   - Priority client attention needed
   - Compliance alerts requiring action
   - New opportunities based on holdings

2. **Smart Recommendations**
   - "Clients who should rebalance"
   - "Funds to discuss with clients"
   - "Tax loss harvesting opportunities"
   - "Model portfolio deviations"

3. **Automated Insights**
   - AI-generated talking points
   - Client-ready analysis
   - Peer comparison insights
   - Performance attribution

#### Integration Architecture
```javascript
// Unified data service
class IntelligenceService {
  async getAdvisorInsights(advisorId) {
    const [holdings, trades, performance] = await Promise.all([
      this.getHoldings(advisorId),
      this.getRecentTrades(advisorId),
      this.getPerformanceMetrics(advisorId)
    ]);
    
    return {
      priorities: this.calculatePriorities(holdings, trades),
      alerts: this.identifyAlerts(holdings),
      opportunities: this.findOpportunities(holdings, performance),
      insights: this.generateInsights(holdings, trades, performance)
    };
  }
}
```

### Automation & Workflows

#### Scheduled Processes
- **Daily**: Priority list generation
- **Weekly**: Rebalancing recommendations
- **Monthly**: Client report preparation
- **Quarterly**: Performance reviews

#### Alert System
- Real-time concentration warnings
- Daily summary emails
- Mobile push notifications
- Integration with CRM system

### Acceptance Criteria - Phase 4
- [ ] Command center loads in <2 seconds
- [ ] Insights generated for 100% of advisors
- [ ] Automated reports 95% accurate
- [ ] Alert delivery within 1 minute
- [ ] Mobile app MVP functional

---

## Technical Implementation Details

### Performance Requirements
- **Dashboard Load**: <3 seconds
- **CSV Import**: 5,000 rows/second
- **Real-time Updates**: <1 second latency
- **Concurrent Users**: Support 20 advisors
- **Data Retention**: 24 months rolling

### Security & Compliance
- **Client Data**: All PII hashed/encrypted
- **Access Control**: Role-based permissions
- **Audit Trail**: Complete activity logging
- **Data Privacy**: GDPR/CCPA compliant
- **Backup**: Daily automated backups

### Technology Stack Additions
- **Data Processing**: Node.js workers for CSV
- **Caching**: Redis for real-time metrics
- **Queue**: Bull for background jobs
- **Monitoring**: Sentry for error tracking
- **Analytics**: Amplitude for usage tracking

---

## Success Metrics

### Business Impact
- **Advisor Efficiency**: 50% reduction in analysis time
- **Recommendation Adoption**: 30% increase in usage
- **Client Satisfaction**: Improved through better insights
- **Revenue Impact**: Identify $10M+ in opportunities
- **Risk Reduction**: 90% fewer concentration violations

### Technical Metrics
- **System Uptime**: 99.9% availability
- **Data Accuracy**: 99.99% calculation precision
- **Import Success**: 95% automated processing
- **User Adoption**: 80% daily active advisors
- **Performance**: All operations <3 seconds

---

## Risk Mitigation

### Identified Risks
1. **Data Quality**: Inconsistent CSV formats
   - *Mitigation*: Robust validation and error handling
   
2. **Performance**: Large data volumes
   - *Mitigation*: Materialized views and caching
   
3. **Adoption**: Advisor resistance to change
   - *Mitigation*: Phased rollout with training
   
4. **Compliance**: Client data exposure
   - *Mitigation*: Encryption and access controls
   
5. **Integration**: Raymond James API limits
   - *Mitigation*: Batch processing and caching

---

## Implementation Checklist

### Week 1-2: Foundation
- [ ] Review and approve database schema
- [ ] Set up development environment
- [ ] Create CSV import utilities
- [ ] Implement data validation
- [ ] Deploy to staging environment

### Week 3-4: Holdings Analytics
- [ ] Build portfolio dashboard components
- [ ] Implement recommendation gap analysis
- [ ] Create concentration risk alerts
- [ ] Develop export functionality
- [ ] Conduct advisor user testing

### Week 5-6: Trade Intelligence
- [ ] Build trade import pipeline
- [ ] Create flow analysis views
- [ ] Implement sentiment indicators
- [ ] Develop pattern detection
- [ ] Test with historical data

### Week 7-8: Platform Integration
- [ ] Build command center UI
- [ ] Implement automated insights
- [ ] Create alert system
- [ ] Develop mobile interface
- [ ] Complete end-to-end testing

---

## Next Steps

### Immediate Actions (This Week)
1. Review and approve this enhancement plan
2. Validate data availability from Raymond James
3. Confirm security requirements with compliance
4. Set up development environment for Phase 1
5. Begin database schema implementation

### Stakeholder Communication
1. Present plan to investment committee
2. Schedule advisor training sessions
3. Coordinate with IT for infrastructure
4. Plan phased rollout strategy
5. Establish success metrics tracking

### Questions to Resolve
1. What is the exact CSV format from Raymond James?
2. Are there API endpoints we can use instead?
3. What are the compliance requirements for client data?
4. Which advisors will be early adopters?
5. What is the budget for additional infrastructure?

---

## Appendix: Technical Specifications

### CSV Field Mappings

#### Holdings File (Generic)
<!-- removed placeholder generic mapping in favor of concrete sample mapping -->

#### Trade File (Generic)
<!-- removed placeholder generic mapping in favor of concrete sample mapping -->

#### Holdings File (From Provided Sample: `Holdings_Data_Example.csv`)
```csv
RJ Header            -> Our_Database_Column
"FA #"               -> advisor_id
"Account #"          -> client_id (hashed)
"Symbol"             -> ticker
"CUSIP"              -> cusip
"Quantity"           -> quantity
"Current Value"      -> market_value
"Account Type"       -> account_type
"Registration Type"  -> registration_type
"Share Class"        -> share_class
"Price"              -> price
"Avg Cost/Share"     -> avg_cost_per_share
"Unrealized G/L"     -> unrealized_gl
"M* Category"        -> ms_category
"First Acq Date"     -> first_acq_date
"Net Exp Ratio"      -> expense_ratio
"Product Name"       -> product_name
"Product Subtype"    -> product_subtype
"Product Type"       -> product_type
```

Notes:
- Rows with empty `Symbol` and `Product Name` of `Usd` represent cash; exclude from per-ticker holdings but optionally aggregate into a `cash` exposure metric.
- `Current Value` includes currency symbols and parentheses for negatives; normalize to decimal.
- `First Acq Date` is not the EOM snapshot date; use explicit `snapshot_date` supplied at import time.

#### Trade File (From Provided Sample: `August2025TradeData.csv`)
```csv
RJ Header              -> Our_Database_Column
"FA"                   -> advisor_id
"Account"              -> client_id (hashed)
"Trade Date"           -> trade_date
"Settlement Date"      -> settlement_date
"Transaction Type"     -> trade_type  // map: Purchase -> BUY, Sale -> SELL
"Product Type"         -> product_type
"Trade Number"         -> external_trade_id
"Shares"               -> quantity
"Amount"               -> principal_amount
"Price"                -> price
"Symbol"               -> ticker
"CUSIP"                -> cusip
"Product Description"  -> product_name
"Cancelled Flag"       -> cancelled (boolean)
```

Note: Additional RJ columns like "Discretionary Trade" and "Time-Price Discretion" may be present but are ignored by the app.

### Validation & Normalization Rules (Phase 1)
- Currency parsing: Strip `$`, `,`, and parentheses; convert to signed decimals.
- Numeric safety: Parse with fixed precision (`numeric(20,2)` for values; `numeric(20,6)` for quantities).
- Date handling: Ingest `snapshot_date` (EOM) from filename or user input; parse `Trade Date` and `Settlement Date` in `YYYY-MM-DD`.
- Enum mapping: `Transaction Type` → `BUY`/`SELL`; reject unknowns.
- Ticker normalization: `toUpperCase()`, trim, allow A–Z/0–9/`.`/`-`; strip others.
- Cash rows: Skip inserting ticker-less cash rows into `client_holdings`; aggregate optional cash exposure separately.
- Deduplication:
  - Holdings: Unique on (`snapshot_date`, `advisor_id`, `client_id`, `ticker`).
  - Trades: Prefer `external_trade_id`; otherwise (`trade_date`, `advisor_id`, `client_id`, `ticker`, `principal_amount`).
- Cancellation: If `Cancelled Flag` is `Y`, set `cancelled = true` and exclude from flow metrics.

### Anonymization & Secrets
- `client_id`: Derive as `HMAC_SHA256(secret, account_number)`; store only hex digest. Secret resides in serverless env/Supabase secret store.
- Never log source account numbers; optionally store one-way hashed `account_source` for audit with same HMAC.
- Enforce Supabase RLS on `client_holdings` and `trade_activity`; restrict access to service role or aggregated views.

### API Endpoints (Future)

```javascript
// Proposed API structure
GET /api/advisor/:id/holdings
GET /api/advisor/:id/trades
GET /api/advisor/:id/insights
POST /api/import/holdings
POST /api/import/trades
GET /api/analytics/flows/:ticker
GET /api/analytics/adoption/:ticker
```

### Performance Benchmarks

| Operation | Target | Current | Improvement |
|-----------|--------|---------|-------------|
| Dashboard Load | <3s | 4.5s | 33% |
| CSV Import (25K) | <10s | N/A | New |
| Trade Analysis | <2s | N/A | New |
| Report Generation | <30s | 45s | 33% |
| Real-time Updates | <1s | N/A | New |

---

*This document is a living roadmap. Updates will be tracked in `/docs/progress.md` as implementation proceeds.*







#### Phase 1 Completion Summary
- Deliverables implemented:
  - DB schema: client_holdings, 	rade_activity + indexes
  - Materialized views: dvisor_metrics_mv, und_flows_mv`r
  - RPCs: efresh_advisor_metrics_mv(), efresh_fund_flows_mv(), get_advisor_metrics(p_date, p_advisor_id), get_fund_flows(p_month, p_ticker, p_limit)
  - Serverless endpoints: /api/import/holdings, /api/import/trades (support dryRun )
  - Admin UI: Holdings & Trades Import with EOM validation, preview, progress, dry-run, result downloads; MV refresh control; confirmation view
  - Dashboard KPIs: Firm AUM (latest holdings), latest flows month + ticker count
- Security decisions:
  - client_id hashing via HMAC-SHA256 with server-side secret; no raw account numbers stored
  - RLS disabled for internal tool (consistent with existing migrations)
- Environment/Secrets required:
  - SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_ANON_KEY), CLIENT_ID_HASH_SECRET`r
- Pending verifications (Phase 1 acceptance tests):
  - Import throughput and MV refresh timings under production-like data volumes
  - Additional unit/integration tests for endpoint validation and error paths
