# CSV Upload Templates

This directory contains CSV templates for uploading fund and benchmark performance data to the Lightship Fund Analysis system.

## Files

- `fund_performance.csv` - Template for fund performance data
- `benchmark_performance.csv` - Template for benchmark performance data

## Template Downloads

**NEW**: You can now download CSV templates directly from the Monthly Snapshot Upload interface:

1. Navigate to **Admin > Monthly Snapshot Upload**
2. Click **"Download Template"** next to either:
   - Fund Performance CSV field (downloads `fund-performance-template.csv`)
   - Benchmark Performance CSV field (downloads `benchmark-performance-template.csv`)

The downloaded templates include:
- ✅ Correct column headers matching the expected format
- ✅ Sample data rows showing the proper data format
- ✅ UTF-8 encoding with BOM for Excel compatibility
- ✅ No date column (date is provided via the UI date picker)

## Upload Instructions

### 1. Fund Performance Upload

Use the `fund_performance.csv` template for uploading mutual fund and ETF performance data.

**Required Columns:**
- `fund_ticker` - Fund ticker symbol (must exist in funds table)
- `date` - Performance date in YYYY-MM-DD format (must be end-of-month)

**Optional Performance Columns:**
- `ytd_return` - Year-to-date return (%)
- `one_year_return` - 1-year return (%)
- `three_year_return` - 3-year annualized return (%)
- `five_year_return` - 5-year annualized return (%)
- `ten_year_return` - 10-year annualized return (%)
- `sharpe_ratio` - Sharpe ratio
- `standard_deviation_3y` - 3-year standard deviation (%)
- `standard_deviation_5y` - 5-year standard deviation (%)
- `expense_ratio` - Net expense ratio (%)
- `alpha` - Alpha vs benchmark
- `beta` - Beta vs benchmark
- `manager_tenure` - Manager tenure in years
- `up_capture_ratio` - Up market capture ratio (%)
- `down_capture_ratio` - Down market capture ratio (%)

### 2. Benchmark Performance Upload

Use the `benchmark_performance.csv` template for uploading benchmark performance data.

**Required Columns:**
- `benchmark_ticker` - Benchmark ticker symbol
- `date` - Performance date in YYYY-MM-DD format (must be end-of-month)

**Performance Columns:** Same as fund performance except:
- No `manager_tenure` field for benchmarks
- `alpha` and `beta` typically 0.0 and 1.0 respectively for primary benchmarks
- `expense_ratio` reflects benchmark tracking cost
- `up_capture_ratio` and `down_capture_ratio` typically 100.0 for benchmarks

## Validation Rules

### Date Validation
- **End-of-Month (EOM) Only**: All dates must be the last day of the month
- **Format**: YYYY-MM-DD (e.g., 2025-01-31, not 2025-01-15)
- **Invalid dates will be rejected** with clear error messages

### Data Type Validation
- **Tickers**: Text, case-insensitive, will be normalized to uppercase
- **Returns**: Numeric values as percentages (e.g., 12.34 for 12.34%)
- **Ratios**: Numeric values (e.g., 1.24 for Sharpe ratio)
- **Percentages**: Numeric values as percentage points (e.g., 0.75 for 0.75% expense ratio)

### Fund Ticker Validation
- Fund tickers must exist in the `funds` table before upload
- Unknown tickers will be flagged for review
- Use the "Seed missing funds" feature in the upload UI if needed

### Required Column Validation
- `fund_ticker` or `benchmark_ticker` - Required
- `date` - Required
- All other columns are optional but recommended for complete analysis

## File Format Requirements

- **File Type**: CSV (.csv)
- **Encoding**: UTF-8
- **Headers**: First row must contain column headers (case-sensitive)
- **Empty Rows**: Will be skipped automatically
- **Missing Values**: Leave cells empty or use null

## Upload Process

1. **Download Template**: 
   - Use the "Download Template" buttons in the Monthly Snapshot Upload interface, OR
   - Use the template files in this directory as starting points
2. **Fill Data**: Replace sample data with your actual performance data
3. **Validate**: Ensure all dates are end-of-month and tickers exist
4. **Upload**: Use the Monthly Snapshot Upload interface in the Admin section
5. **Review**: Check validation results and fix any errors
6. **Import**: Confirm import after validation passes

## Idempotent Operations

- **Re-upload Safe**: Uploading the same file multiple times will result in zero net database changes
- **Conflict Resolution**: Data is upserted based on (ticker, date) combinations
- **Activity Logging**: All upload attempts are logged for audit purposes

## Error Handling

Common validation errors and solutions:

- **"Invalid date format"**: Ensure dates are YYYY-MM-DD format
- **"Non-EOM date"**: Change date to last day of month (e.g., 2025-01-31 not 2025-01-15)
- **"Unknown ticker"**: Add fund to database first or use seed function
- **"Invalid numeric value"**: Check for text in numeric columns
- **"Missing required column"**: Ensure ticker and date columns are present

## Sample Data

The templates include realistic sample data to demonstrate proper formatting. Replace this data with your actual performance figures before uploading.

## Data Sources

Performance data typically comes from:
- Morningstar Direct
- Bloomberg Terminal
- Fund company reports
- Custodial platforms

Ensure data is as of the same end-of-month date for consistency across all funds and benchmarks.