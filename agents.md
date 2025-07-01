# AGENTS.md - Lightship Fund Analysis App

## Project Overview
This is a React-based internal web application for wealth management teams to analyze fund performance monthly. The app processes Raymond James performance data, calculates custom ranking scores, and provides peer group comparisons for investment committee decisions.

## Core Business Logic
- **Ranking Score**: Uses weighted Z-scores (0-100 scale) to rank funds within asset classes
- **Asset Classes**: Funds are grouped by investment type (Large Cap Growth, Real Estate, etc.)
- **Benchmarking**: Each asset class has a designated ETF benchmark for comparison
- **Monthly Workflow**: Upload FundPerformance.xlsx → Analyze → Make investment decisions

## Code Style & Architecture

### Component Organization
- Favor existing components over creating new ones
- Before creating a new component, check if existing components can satisfy requirements through props
- Keep components focused on single responsibilities
- Use functional components with hooks (no class components)

### Data Handling
- **Fund Data**: Always clean symbols using the `clean()` function for consistency
- **Asset Class Matching**: Use the `recommendedFunds` array to assign asset classes to uploaded data
- **Benchmarks**: Store in `assetClassBenchmarks` object, match by ticker to fund data
- **State Management**: Use React hooks, avoid external state libraries unless absolutely necessary

### File Processing
- Use XLSX.js for Excel parsing
- Always handle missing data gracefully (use `|| 'N/A'` or `?? 'N/A'`)
- Parse percentage strings by removing '%' and ',' before converting to numbers
- Find header row dynamically, don't assume fixed positions

### Mathematical Calculations
- **Z-Score Formula**: `(value - mean) / standardDeviation`
- **Scoring Weights**: Follow the exact weights defined in the scoring model document
- **Missing Data**: Handle undefined/null values in calculations
- **Peer Groups**: Calculate statistics within asset class only, not across all funds

## Naming Conventions

### Variables & Functions
```javascript
// Good - descriptive names
const fundPerformanceData = [];
const calculateZScore = (value, mean, stdDev) => {};
const assetClassBenchmarks = {};

// Bad - abbreviations
const fpd = [];
const calcZ = () => {};
const acb = {};
```

### Asset Classes
- Use exact strings from the config file
- Maintain consistency with Raymond James categorization
- Examples: "Large Cap Growth", "Intermediate Muni", "Real Estate"

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
  "Sharpe Ratio": 1.2,
  "Standard Deviation": 10.5,
  "Net Expense Ratio": 0.65,
  "Manager Tenure": 5
}
```

### Benchmark Object Structure
```javascript
{
  "Large Cap Growth": {
    ticker: "IWF",
    name: "Russell 1000 Growth"
  }
}
```

## UI/UX Guidelines

### Tables
- Right-align numerical data
- Left-align text data
- Use consistent padding (0.25rem for cells)
- Highlight benchmark rows with background color
- Show "N/A" for missing data, never empty cells

### Tabs & Navigation
- Maintain three main tabs: Fund View, Class View, Admin
- Use Lucide React icons consistently
- Keep active tab state in component

### Data Loading
- Show loading indicators during file processing
- Display row counts after successful load
- Handle errors gracefully with user-friendly messages

## Performance Considerations

### Data Processing
- Process large datasets efficiently with array methods
- Avoid nested loops where possible
- Cache calculated values when reused
- Use `useMemo` for expensive calculations

### File Handling
- Stream large Excel files rather than loading entirely into memory
- Validate data structure before processing
- Provide progress feedback for long operations

## Testing Guidelines

### Data Validation
- Always test with sample Raymond James files
- Verify asset class matching works correctly
- Test edge cases: missing data, malformed files, empty cells
- Validate scoring calculations with known inputs

### User Scenarios
- Test monthly workflow: upload → view → analyze → admin changes
- Verify benchmark comparisons are accurate
- Test admin panel: add/edit/delete funds and benchmarks

## Security & Data Handling

### Sensitive Data
- Fund performance data is confidential - no external API calls with this data
- Use localStorage only for configuration, not performance data
- Clear sensitive data on page refresh if needed

### File Uploads
- Validate file extensions (.xlsx, .xls, .csv)
- Handle malicious or corrupted files gracefully
- Limit file size if necessary

## Common Patterns

### Asset Class Filtering
```javascript
// Good - reusable pattern
const getFundsByAssetClass = (funds, assetClass) => 
  funds.filter(f => f['Asset Class'] === assetClass);

// Use throughout the app for consistency
```

### Symbol Cleaning
```javascript
// Good - centralized utility
const clean = (s) => s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');

// Apply to all symbol comparisons
```

### Safe Number Parsing
```javascript
// Good - handles strings and numbers
const parseMetric = (value) => {
  if (typeof value === 'string') {
    value = value.replace('%', '').replace(',', '');
  }
  return isNaN(value) ? null : parseFloat(value);
};
```

## Development Workflow

### Before Making Changes
1. Review existing components and utilities
2. Check if similar functionality already exists
3. Understand the business context and monthly workflow
4. Test with real Raymond James data when possible

### Adding New Features
1. Follow the established patterns above
2. Update both data structures and UI consistently
3. Consider impact on scoring calculations
4. Test across all three main tabs

### Debugging
- Use browser dev tools to inspect fund data structure
- Console.log intermediate calculations for scoring
- Verify asset class assignments are correct
- Check benchmark matching by ticker

## Future Considerations

### Potential Enhancements
- Historical data tracking (monthly snapshots)
- Advanced filtering and sorting
- Export capabilities for investment committee reports
- Performance trend analysis
- Risk-adjusted return visualizations

### Technical Debt to Address
- Consider migrating to TypeScript for better type safety
- Add proper error boundaries
- Implement data validation schemas
- Consider database integration for historical data

## Dependencies

### Current Stack
- React 18+ with hooks
- XLSX.js for Excel parsing
- Lucide React for icons
- No external UI libraries (custom styles)

### Approved Libraries
- lodash (for data manipulation if needed)
- date-fns (for date handling if needed)
- recharts (for future visualization features)

### Avoid
- Heavy UI frameworks (Material-UI, Ant Design) - keep it lightweight
- External state management (Redux, Zustand) - React state is sufficient
- Complex charting libraries until needed

---

**Remember**: This app directly impacts investment decisions affecting millions of dollars. Accuracy and reliability are paramount. Always double-check calculations and test thoroughly.