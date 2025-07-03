# AGENTS.md - Lightship Fund Analysis App

## Project Overview
Advanced React-based fund analysis platform for wealth management teams. Features comprehensive scoring algorithms, historical tracking, automated tagging, and investment committee reporting tools.

## Current Architecture
- **Frontend**: React 18+ with functional components and hooks
- **Data Storage**: IndexedDB for historical snapshots and fund registry
- **Scoring Engine**: Sophisticated Z-score based ranking within peer groups
- **Analytics**: Risk-return analysis, correlation matrices, performance attribution
- **Export**: Excel, CSV, and HTML report generation

## Development Philosophy
- **Accuracy First**: This impacts real investment decisions - calculations must be precise
- **Progressive Enhancement**: Start simple, add complexity as needed
- **User-Centric**: Optimize for the monthly workflow of fund analysts
- **Maintainable**: Clear code is better than clever code

## Key Features to Understand
1. **Scoring System**: Custom weighted Z-score model (see scoring.js)
2. **Fund Registry**: Centralized fund and benchmark management
3. **Historical Tracking**: Monthly snapshots with comparison capabilities
4. **Tag Engine**: Automated fund classification based on performance
5. **Analytics Suite**: Advanced visualizations and portfolio analysis

## Core Business Logic
- **Ranking Score**: Uses weighted Z-scores (0-100 scale) to rank funds within asset classes
- **Asset Classes**: Funds are grouped by investment type (Large Cap Growth, Real Estate, etc.)
- **Benchmarking**: Each asset class has a designated ETF benchmark for comparison
- **Monthly Workflow**: Upload FundPerformance.xlsx → Analyze → Make investment decisions

## Code Guidelines

### When Adding Features
- Check if similar functionality exists in the codebase
- Consider the impact on existing features
- Maintain consistency with established patterns
- Test with real Raymond James data

### Component Development
- Create new components when they improve clarity or reusability
- Use composition over inheritance
- Keep components focused but not overly granular
- Consider performance implications for large datasets

### State Management
- Use React hooks for component state
- Consider context or external state management for complex shared state
- Leverage IndexedDB for persistence
- Cache expensive calculations with useMemo

### Data Processing
- Always handle missing/null data gracefully
- Use the established clean() function for symbol matching
- Validate data types before calculations
- Provide meaningful error messages

## Data Structure Standards

### Fund Object Structure
```javascript
{
  Symbol: "PRWCX",              // Always uppercase, cleaned
  "Fund Name": "T. Rowe Price...",
  "Asset Class": "Asset Allocation",
  "YTD": 12.5,                  // Numbers, not strings
  "1 Year": 15.3,
  "3 Year": 8.2,
  "5 Year": 10.1,
  "10 Year": 8.5,
  "Sharpe Ratio": 1.2,
  "StdDev3Y": 10.5,
  "StdDev5Y": 11.2,
  "Net Expense Ratio": 0.65,
  "Manager Tenure": 5,
  scores: {                     // Added by scoring engine
    final: 68,
    percentile: 85,
    breakdown: {...}
  }
}
Benchmark Object Structure
javascript{
  "Large Cap Growth": {
    ticker: "IWF",
    name: "Russell 1000 Growth"
  }
}
UI/UX Guidelines
Tables

Right-align numerical data
Left-align text data
Use consistent padding (0.75rem standard)
Highlight benchmark rows and recommended funds
Show "-" for missing data, never empty cells

Navigation

Main tabs: Dashboard, Fund Scores, Class View, Analysis, Analytics, History, Admin
Use Lucide React icons consistently
Maintain active tab state
Show notification badges for items needing attention

Data Loading

Show loading indicators during file processing
Display success messages with fund counts
Handle errors gracefully with actionable messages
Preserve data across tab switches

Common Patterns
Asset Class Filtering
javascript// Good - reusable pattern
const getFundsByAssetClass = (funds, assetClass) => 
  funds.filter(f => f['Asset Class'] === assetClass);
Symbol Cleaning
javascript// Good - centralized utility
const clean = (s) => s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');

// Apply to all symbol comparisons
Safe Number Parsing
javascript// Good - handles strings and numbers
const parseMetric = (value) => {
  if (typeof value === 'string') {
    value = value.replace('%', '').replace(',', '');
  }
  return isNaN(value) ? null : parseFloat(value);
};
Current Tech Stack

React 18+
XLSX.js for Excel parsing
IndexedDB via custom dataStore service
Lucide React icons
Custom styling (no UI framework currently)

Areas Open for Enhancement

Consider TypeScript migration for better type safety
Evaluate charting libraries for enhanced visualizations
Explore server-side storage for team collaboration
Consider PWA capabilities for offline use
Investigate performance optimizations for large datasets (200+ funds)
Add real-time collaboration features
Implement automated report scheduling

Testing Priorities

Scoring calculations accuracy
Asset class matching logic
Historical data integrity
Export functionality
Admin panel operations
Tag engine rules
Analytics calculations

Performance Considerations

Use virtualization for large fund lists
Debounce search and filter operations
Lazy load analytics components
Cache expensive calculations
Consider web workers for heavy computations

Security & Data Handling

Fund performance data is confidential
No external API calls with fund data
Use IndexedDB for persistence, not localStorage for sensitive data
Validate all file uploads
Sanitize user inputs in admin panel

Development Workflow
Before Making Changes

Understand the business context
Review existing implementations
Consider performance implications
Plan for edge cases

When Building Features

Start with the simplest working version
Add complexity incrementally
Write clear, self-documenting code
Test with real data when possible

Code Quality

Prefer clarity over cleverness
Comment complex calculations
Use meaningful variable names
Keep functions focused and testable

Remember
This tool directly impacts investment decisions affecting millions of dollars. When in doubt:

Prioritize accuracy over features
Test edge cases thoroughly
Maintain data integrity
Keep the user workflow smooth
Double-check all calculations
Preserve audit trails