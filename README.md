# Lightship Fund Analysis Platform

A comprehensive fund performance analysis platform built for financial advisors, featuring real-time data integration, professional reporting, and client-ready analytics.

## 🚨 **IMPORTANT: CSV-only MVP (Phase 3) and YCharts Status**

**Current Status (January 2025):**
- ✅ Phase 3 pivoted to a CSV-only MVP. All ingestion and exports work without YCharts.
- ⚠️ YCharts integration remains implemented but de-prioritized for MVP; API access pending (403s observed).
- 🔄 When access is granted, the app can switch to real YCharts data without scope changes.

**What this means for development:**
- Focus on CSV ingestion, saved views, research notes, compare sets, and exports.
- No Health surfacing of YCharts schedule/errors in MVP.
- YCharts code paths remain in place and can be re-enabled post-MVP.

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

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Domain Docs

- Scoring policy: [docs/SCORING_POLICY.md](./docs/SCORING_POLICY.md)
- Advisor glossary: [docs/advisor_glossary.md](./docs/advisor_glossary.md)

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

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

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
