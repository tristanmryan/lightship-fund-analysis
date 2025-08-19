# Real Fund Data Import Guide

This document provides a comprehensive guide for importing real fund data to replace sample data and prepare the application for professional launch.

## Overview

The Real Data Import process replaces all sample data with actual fund and benchmark data from CSV files, preparing the application for professional use.

### Data Sources

The import process uses three CSV files located in `src/data/real-data/`:

1. **Benchmarks.csv** (32 benchmarks)
   - Columns: Asset Class, Assigned Benchmark, Chosen ETF Ticker, Benchmark Name
   - Creates benchmark records and asset class mappings

2. **RecListFunds.csv** (107 recommended funds)
   - Columns: Fund Ticker, Fund Name, Asset Class
   - Imports with `is_recommended = true`

3. **NonRecListFunds.csv** (42 non-recommended funds)
   - Columns: Symbol, Product Description, Asset Class
   - Imports with `is_recommended = false`

### Expected Results

- **Total Funds**: 149 (107 recommended + 42 non-recommended)
- **Unique Benchmarks**: ~20-25 (some benchmarks serve multiple asset classes)
- **Asset Class Mappings**: 32 primary benchmark assignments

## Import Process

### Method 1: Web Interface (Recommended)

1. Navigate to **Admin Panel** → **Utilities**
2. Click the **"Real Data Import"** tab
3. Select the three CSV files:
   - Benchmarks.csv
   - RecListFunds.csv  
   - NonRecListFunds.csv
4. Click **"Import Real Data"**
5. Monitor progress and review results

### Method 2: Programmatic Import

```javascript
import { validateRealDataImport } from '../scripts/validateRealDataImport.js';

// Validate current import status
const isValid = await validateRealDataImport();
console.log('Import validation:', isValid ? 'PASSED' : 'FAILED');
```

## Import Steps

The import process follows these steps:

### 1. Data Clearing
- Removes all existing sample funds
- Clears benchmark records
- Removes asset class benchmark mappings
- Preserves asset class definitions and user data

### 2. Benchmark Import
- Reads Benchmarks.csv
- **Handles duplicate benchmarks**: Same ticker can serve multiple asset classes
- Creates unique benchmark records using UPSERT (INSERT ... ON CONFLICT)
- Establishes primary asset class mappings (kind='primary', rank=1) for each asset class
- Validates asset class references
- **Result**: Fewer unique benchmarks than CSV rows, but all 32 asset classes get mapped

### 3. Recommended Funds Import
- Reads RecListFunds.csv  
- Creates fund records with `is_recommended = true`
- Maps to existing asset classes
- Validates fund ticker format

### 4. Non-Recommended Funds Import
- Reads NonRecListFunds.csv
- Creates fund records with `is_recommended = false`
- Maps Symbol → ticker, Product Description → name
- Ensures proper classification

### 5. Validation
- Counts imported records
- Verifies expected totals
- Checks data integrity
- Reports success/failure status

## Post-Import Verification

After import completion, verify the following:

### UI Verification
1. **Asset Class Table**: Should display real fund names (no more RJFA* sample tickers)
2. **Compare View**: Should work with actual fund tickers from CSV files
3. **Dashboard**: Should show accurate fund counts (107 recommended, 42 non-recommended)
4. **Fund selection dropdowns**: Should contain real fund names

### Data Verification
Run the validation script:
```bash
node src/scripts/validateRealDataImport.js
```

Expected output:
```
📊 Import Validation Results:
  Unique Benchmarks: 23 (expected: 20+)
  Asset Class Mappings: 32 (expected: 32)
  Recommended funds: 107 (expected: 107)
  Non-recommended funds: 42 (expected: 42)
  Total funds: 149 (expected: 149)

✅ Validation Status: PASSED
```

## Troubleshooting

### Common Issues

#### Asset Class Mismatch
- **Problem**: Asset class names in CSV don't match database
- **Solution**: Check asset class synonyms or update CSV data
- **Check**: Ensure asset class names are exact matches

#### Duplicate Benchmark Tickers
- **Problem**: Same benchmark ticker assigned to multiple asset classes (e.g., AGG, QAI, ITM)
- **Solution**: Import process now handles this correctly using UPSERT and many-to-many mappings
- **Check**: Verify that all 32 asset classes have benchmark mappings, even if some benchmarks serve multiple classes

#### Duplicate Fund Tickers
- **Problem**: Fund ticker already exists
- **Solution**: Import process uses upsert, should overwrite existing
- **Action**: Manual cleanup may be required

#### Missing Asset Classes
- **Problem**: CSV references asset classes not in database
- **Solution**: Add missing asset classes or update CSV
- **Check**: Validate asset class dictionary completeness

### Error Recovery

If import fails:
1. Check error messages in the import results
2. Verify CSV file formats and data integrity
3. Ensure database connectivity
4. Re-run import after fixing issues

### Rollback (Emergency)

To restore sample data:
1. Use **Professional Reset** in Admin → Utilities
2. Re-seed with sample data using existing seed utilities
3. Or restore from database backup

## File Structure

```
src/
├── data/real-data/
│   ├── Benchmarks.csv          # 32 benchmarks
│   ├── RecListFunds.csv        # 107 recommended funds  
│   └── NonRecListFunds.csv     # 42 non-recommended funds
├── components/Admin/
│   └── RealDataImporter.jsx    # Import UI component
└── scripts/
    ├── importRealData.js       # Node.js import script
    └── validateRealDataImport.js # Validation utilities
```

## CSV Format Requirements

### Benchmarks.csv
```csv
Asset Class,Assigned Benchmark,Chosen ETF Ticker,Benchmark Name
Large Cap Blend,Russell 1000,IWB,Russell 1000
```

### RecListFunds.csv  
```csv
Fund Ticker,Fund Name,Asset Class
CAIFX,American Funds Cap Inc Build,Asset Allocation
```

### NonRecListFunds.csv
```csv
Symbol,Product Description,Asset Class
WMFFX,WASHINGTON MUTUAL INVESTORS FUND CL F2,Large Cap Value
```

## Professional Launch Checklist

After successful import:

- [ ] All 149 funds imported correctly
- [ ] All 32 benchmarks imported with mappings
- [ ] Asset Class Table shows real fund names
- [ ] Compare View functions with real tickers
- [ ] Dashboard displays accurate counts
- [ ] No sample data (RJFA*) remains
- [ ] Validation script passes
- [ ] UI testing completed
- [ ] Performance data upload tested

## Maintenance

### Future Updates
- Use the same import process for fund list updates
- Backup current data before major imports
- Validate data integrity after each import
- Monitor for new asset classes or benchmark changes

### Data Governance
- Maintain CSV files in version control
- Document any manual fund additions/removals
- Regular validation of data accuracy
- Coordinate with data sources for updates

## Support

For issues or questions regarding the real data import:
1. Check this documentation
2. Review error logs in browser console
3. Run validation scripts for diagnostics
4. Check database connectivity and permissions