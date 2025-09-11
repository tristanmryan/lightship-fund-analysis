# Lightship Fund Analysis Platform

A comprehensive fund performance analysis platform built for financial advisors, featuring CSV-based data ingestion, professional scoring algorithms, and client-ready analytics.

## 🚀 **Current Status (September 2025)**

**Platform Overview:**
- ✅ Production-ready CSV-only MVP with comprehensive fund analysis
- ✅ Advanced scoring system with customizable weights
- ✅ Professional reporting and export capabilities
- ✅ Research notes and comparison tools
- ✅ Clean, maintainable codebase (recently optimized)

**Recent Improvements (September 2025):**
- 🧹 Major codebase cleanup: Removed 50+ unused components and files
- 📦 Streamlined from 157 to 128 source files (-18% reduction)
- 🗂️ Organized documentation and removed development artifacts
- 🚀 Improved build performance and maintainability

**Architecture:**
- React 19 frontend with modern component architecture
- Supabase backend for data persistence and real-time features
- Vercel deployment with serverless API functions
- Professional table components with advanced filtering

---

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### Additional Scripts

- `npm run process-data` - Process and build data files
- `npm run setup` - Initialize project setup
- `npm run import:samples` - Import sample data for development
- `npm run test:ci` - Run tests in CI mode

**Available Utility Scripts:**
- `scripts/adminStatus.mjs` - Check admin system status
- `scripts/benchAlerts.mjs` - Benchmark alert performance
- `scripts/benchFlows.mjs` - Benchmark flow calculations
- `scripts/validateFlows.mjs` - Validate flow data accuracy
- `scripts/buildData.mjs` - Build and process data files
- `scripts/importSamples.mjs` - Import sample datasets

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Domain Docs

- Scoring policy: [docs/SCORING_POLICY.md](./docs/SCORING_POLICY.md)
- Advisor glossary: [docs/advisor_glossary.md](./docs/advisor_glossary.md)
- Dashboard redesign (Home): [docs/dashboard_redesign.md](./docs/dashboard_redesign.md)

### CSV-only MVP (Phase 3)

- Use Admin → Data Uploads → Monthly Snapshot Upload to import a month of performance via CSV. The Month/Year picker is required and overrides CSV dates.
- Seed Recommended Funds and Benchmarks via Admin seeders (CSV templates provided).
- Exports available:
  - Dashboard: Table CSV, Compare CSV, PDF (all filtered or recommended-only)
  - Admin Overview: Recommended-only CSV, Primary Benchmark Mapping CSV, PDF (all funds)

### Export filename conventions
- Table CSV: `table_export_YYYYMMDD_HHMMSS.csv`
- Compare CSV: `compare_export_YYYYMMDD_HHMMSS.csv`
- Recommended (Dashboard): `recommended_list_YYYYMMDD_HHMMSS.csv`
- Recommended (Admin Overview): `recommended_only_YYYYMMDD.csv`

## 🧭 App Navigation

- **Dashboard**: Complete fund universe with advanced scoring and filtering
- **Recommended**: Curated fund recommendations by asset class
- **Portfolios**: Holdings analysis and portfolio management tools
- **Trading**: Fund flow analysis and trading activity insights
- **Scoring**: Customizable scoring weights and methodology
- **Reports**: Professional PDF and CSV export capabilities
- **Admin**: Data management and system administration tools

## 🏗️ Architecture Overview

**Core Components:**
- `Dashboard/` - Main fund analysis interface with scoring tooltips
- `Scoring/` - Scoring system with customizable weights
- `Admin/` - Data upload, fund management, and system tools
- `tables/` - Professional table components with advanced features
- `Reports/` - PDF generation and export functionality

**Key Services:**
- `fundService.js` - Core fund data operations
- `scoringService.js` - Fund scoring algorithms
- `exportService.js` - PDF and CSV export functionality
- `weightService.js` - Scoring weight management

## 🔧 Development

**Prerequisites:**
- Node.js 18+ 
- npm or yarn
- Supabase account (for backend)
- Vercel account (for deployment)

**Environment Setup:**
1. Copy `env.example` to `.env.local`
2. Configure Supabase credentials
3. Run `npm run setup` for initial project setup
4. Use `npm run import:samples` to load sample data

**Key Features:**
- 📊 Advanced fund scoring with customizable weights
- 📈 Professional PDF reports and CSV exports  
- 🔍 Research notes with append-only architecture
- 📋 Comparison tools and saved views
- 🎯 Asset class analysis and benchmarking

## Admin Options

The **Admin** page allows management of fund lists and benchmark mappings. It also provides controls for adjusting the scoring weights used by the ranking engine. Navigate to the **scoring** tab inside the Admin page to view all metrics and their current weightings. Enter new numeric weights, click **Save** to persist them, or **Reset** to return to the defaults.

### Monthly Snapshot Upload (CSV)
- Behind flag `REACT_APP_ENABLE_IMPORT=true`.
- CSV columns:
  - Required: `Ticker`, `AsOfMonth` (YYYY-MM-DD, end-of-month recommended; non-EOM will warn but can proceed)
  - Supported metrics (upsert into `fund_performance`): `ytd_return, one_year_return, three_year_return, five_year_return, ten_year_return, sharpe_ratio, standard_deviation, expense_ratio, alpha, beta, manager_tenure, up_capture_ratio, down_capture_ratio`
- Units normalization: accepts `12.34`, `12.34%`, or `0.1234` as-is; `expense_ratio` `0.65` means 0.65%.
- Unknown tickers are skipped.
- Import is idempotent on (`fund_ticker`,`date`).

Example CSV:

```
Ticker,AsOfMonth,ytd_return,one_year_return,three_year_return,five_year_return,ten_year_return,sharpe_ratio,standard_deviation,expense_ratio,alpha,beta,manager_tenure,up_capture_ratio,down_capture_ratio
PRWCX,2025-05-31,8.12,15.34,9.21,10.05,8.45,0.98,12.40,0.65,1.23,0.95,6.5,105.2,92.6
IWF,2025-05-31,10.11,18.90,11.45,12.30,10.02,1.05,14.10,0.19,0.00,1.00,0.0,100.0,100.0
```
