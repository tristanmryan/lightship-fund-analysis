# AGENTS.md - Lightship Fund Analysis App

## Project Overview
Enterprise-grade fund analysis platform for Raymond James wealth management advisors. Features sophisticated server-side scoring algorithms, real-time data ingestion, comprehensive reporting, and investment committee-ready visualizations.

## Current Architecture
- **Frontend**: React 19 with TypeScript, functional components and hooks
- **Backend**: Supabase (PostgreSQL) with custom RPCs and materialized views
- **Hosting**: Vercel with serverless functions
- **Scoring Engine**: Z-score based ranking with configurable profiles and weights
- **Data Pipeline**: CSV ingestion with EOM normalization and validation
- **Export**: Professional PDF reports via React-PDF, Excel/CSV exports

## Development Philosophy
- **Accuracy First**: This impacts real investment decisions - calculations must be mathematically precise
- **Server-Side Performance**: Heavy computations in PostgreSQL, not client browser
- **Advisor-Centric**: Optimized for monthly investment committee workflows
- **Explainable AI**: Scoring model must be transparent and client-presentable
- **Enterprise Ready**: Audit trails, data governance, and compliance-ready

## Key Features to Understand

### 1. **Sophisticated Scoring System**
- **Server-side computation**: Scoring runs in PostgreSQL via RPCs for consistency
- **Multiple scoring models**: Different algorithms for equity vs fixed income vs alternatives
- **Z-score methodology**: Statistical ranking within asset class peer groups
- **Configurable weights**: Admin can adjust metric importance per asset class
- **Breakdown transparency**: Each score shows per-metric contributions

### 2. **Data Architecture**
- **Monthly snapshots**: End-of-month (EOM) normalized performance data
- **Asset class resolution**: Sophisticated mapping with primary benchmark assignment
- **Audit trails**: All changes tracked with user attribution and timestamps
- **Research notes**: Append-only decision logs per fund with decision context

### 3. **Professional Reporting**
- **Investment committee PDFs**: Multi-table layouts with Apple-quality design
- **Excel exports**: Formatted for financial analysis with consistent number formatting
- **Interactive dashboards**: Real-time data with drill-down capabilities

## Core Business Logic

### Scoring Algorithm (src/services/scoring.js)
```javascript
// Z-score based ranking within asset class peer groups
// Excludes benchmarks from peer statistics
// Configurable weights via scoring profiles
// Returns 0-100 scale with breakdown details

final_score = Σ(weight_i × z_score_i) * normalization_factor
```

### Data Flow Architecture
```
CSV Upload → Validation → EOM Conversion → Supabase → RPC Processing → 
→ Materialized Views → React Components → Professional Exports
```

### Asset Class & Benchmark Resolution
- **Primary benchmarks**: Each asset class mapped to designated ETF
- **Performance deltas**: Automatic calculation vs benchmark
- **Missing data handling**: Graceful degradation with fallback values

## Database Schema (Supabase)

### Core Tables
```sql
-- Fund registry and performance
funds (id, ticker, name, asset_class_id, created_at)
fund_performance (ticker, date, ytd_return, one_year_return, ..., expense_ratio)
asset_classes (id, name, primary_benchmark_id)
benchmarks (id, ticker, name, asset_class_id)
benchmark_performance (ticker, date, ytd_return, ...)

-- Scoring system
scoring_profiles (id, name, is_default, created_at)
scoring_weights (id, profile_id, scope, scope_id, metric, weight)
metric_stats_as_of (asset_class_id, date, metric, mean, stddev, count)
scores_as_of (asset_class_id, fund_ticker, date, score_final, breakdown)

-- Governance and audit
fund_research_notes (id, fund_id, note, decision, created_at, author)
activity_logs (id, user_id, action, details, created_at)
```

### Key RPCs (Performance Critical)
```sql
-- Data retrieval
get_funds_as_of(p_date) → enriched fund data with performance
get_asset_class_table(p_date, p_asset_class_id, p_include_benchmark) → scored funds + benchmark
get_scores_as_of(p_date, p_asset_class_id, p_limit, p_after) → paginated scored results
get_compare_dataset(p_date, p_tickers[]) → side-by-side comparison data

-- Scoring computation
refresh_metric_stats_as_of(p_date) → compute peer group statistics
refresh_scores_as_of(p_date) → compute all fund scores for date
```

## Code Guidelines

### When Adding Features
- **Check existing patterns**: Leverage established services and components
- **Server-side first**: Move computations to PostgreSQL when possible
- **Maintain scoring accuracy**: Any changes to scoring logic require mathematical validation
- **Feature flags**: Use environment variables for gradual rollouts
- **Test with real data**: Raymond James production-like datasets

### Component Development
- **Composition over complexity**: Reuse existing dashboard components
- **Performance conscious**: Virtualize large fund lists, debounce searches
- **Professional styling**: Raymond James brand standards with Apple-quality polish
- **Accessibility**: Proper ARIA labels and keyboard navigation
- **Error boundaries**: Graceful failure handling for advisor workflows

### Data Processing Standards
```javascript
// Preferred patterns
const fundsByAssetClass = funds.filter(f => f.asset_class_id === targetId);
const cleanTicker = ticker?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
const safeNumber = value => isNaN(value) ? null : parseFloat(value);

// Use centralized formatting
import { fmt } from '../utils/fmt';
const displayPercent = fmt.percent(value, { decimals: 2, sign: true });
```

## Current Tech Stack

### Frontend
- **React 19** with functional components and hooks
- **TypeScript** for type safety and better developer experience
- **Tailwind CSS** for consistent styling and rapid development
- **Lucide React** for professional iconography
- **React-PDF** for investment committee report generation

### Backend & Data
- **Supabase** (PostgreSQL) with Row Level Security
- **Custom SQL functions** for complex business logic
- **Materialized views** for performance optimization
- **JSONB storage** for flexible metadata and audit trails

### Development & Deployment
- **Vercel** for hosting with serverless functions
- **Environment-based feature flags** for safe deployments
- **Comprehensive testing** with Jest and React Testing Library
- **Performance monitoring** with custom benchmarking harness

## Performance Targets

### Database Operations (95th percentile)
- `get_funds_as_of`: < 800ms
- `get_asset_class_table`: < 1200ms  
- `refresh_scores_as_of`: < 5000ms
- CSV import (500 rows): < 10000ms

### UI Responsiveness
- Dashboard load: < 3 seconds
- Table sorting/filtering: < 500ms
- PDF generation: < 30 seconds
- Export operations: < 15 seconds

## Security & Compliance

### Data Protection
- **Fund data confidentiality**: No external API calls with sensitive data
- **Audit trails**: Complete change tracking for compliance
- **Input validation**: Comprehensive sanitization of all user inputs
- **Role-based access**: Ready for multi-advisor deployment

### Development Security
- **Environment variable protection**: No secrets in client code
- **SQL injection prevention**: Parameterized queries and RPC patterns
- **XSS protection**: Input sanitization and output encoding
- **CSRF protection**: Supabase built-in security measures

## Testing Priorities

### Mathematical Accuracy
- **Scoring calculations**: Z-score computations and weight applications
- **Statistical functions**: Mean, standard deviation, percentile calculations
- **Performance attribution**: Delta calculations vs benchmarks
- **Export consistency**: Identical data across PDF/Excel/CSV formats

### Data Integrity
- **EOM conversion**: Date normalization accuracy
- **Asset class mapping**: Fund categorization correctness  
- **Benchmark resolution**: Primary benchmark assignment logic
- **Historical data**: Snapshot consistency over time

### User Workflows
- **Admin panel operations**: CRUD operations with validation
- **Import processing**: CSV validation and error handling
- **Export generation**: Professional formatting and completeness
- **Dashboard interactions**: Filtering, sorting, drill-down functionality

## Current Implementation Status

### ✅ Completed Features
- Server-side scoring with configurable profiles
- Professional PDF reports with multi-table layouts
- CSV data ingestion with validation
- Asset class and benchmark resolution
- Research notes and decision tracking
- Admin panel for data management

### 🚧 In Development
- Interactive score visualization and explanation tools
- What-if analysis for hypothetical fund scoring
- Enhanced comparison interfaces with side-by-side analysis
- Multiple scoring models per asset class

### 📋 Planned Enhancements
- Real-time collaboration features
- Advanced analytics and trend analysis
- Client portal integration
- Automated report scheduling
- Mobile-responsive interface improvements

## Integration Points

### External Services
- **YCharts API**: Market data ingestion (with mock fallback)
- **Supabase Auth**: User authentication and session management
- **Vercel Analytics**: Performance monitoring and usage tracking

### Internal Services
```javascript
// Key service modules
fundService.js              // CRUD operations and data loading
scoring.js                 // Runtime scoring calculations  
scoringProfilesService.js  // Scoring configuration management
exportService.js           // Report generation (PDF/Excel/CSV)
asOfStore.js              // Date resolution and EOM handling
```

## Development Workflow

### Before Making Changes
1. **Understand business impact**: How does this affect advisor workflows?
2. **Review scoring implications**: Will this change affect fund scores?
3. **Check performance impact**: Database query performance considerations
4. **Plan testing strategy**: Mathematical validation requirements

### Implementation Process
1. **Feature flags first**: Environment variable controls for safe rollouts
2. **Database changes**: Migrations with rollback plans
3. **Service layer updates**: Business logic in appropriate services
4. **UI component development**: Reuse existing patterns and styling
5. **Comprehensive testing**: Unit, integration, and user acceptance testing

### Quality Standards
- **Code clarity over cleverness**: Self-documenting, maintainable code
- **Mathematical precision**: Double-check all financial calculations
- **Professional presentation**: Investment committee-ready interfaces
- **Performance optimization**: Sub-second response times for interactive features
- **Error handling**: Graceful degradation with meaningful user feedback

## Remember: Mission Critical System

This platform directly impacts investment decisions affecting millions of dollars in client assets. Every feature must meet the highest standards of:

- **Mathematical accuracy**: Precise calculations with audit trails
- **Data integrity**: Consistent, reliable information across all views
- **Professional presentation**: Investment committee-ready reports and interfaces
- **Performance reliability**: Fast, responsive user experience
- **Regulatory compliance**: Transparent, auditable decision processes

When in doubt, prioritize accuracy over features, reliability over innovation, and clarity over complexity.