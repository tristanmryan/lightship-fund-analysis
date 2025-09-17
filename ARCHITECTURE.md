# Lightship Fund Analysis - Architecture

## Data Architecture

### Core Data Tables

1. **client_holdings**: All client asset positions across all advisors
   - Contains ALL assets: ETFs, mutual funds, stocks, bonds, etc.
   - Source of truth for actual client portfolio positions
   - Used for advisor-specific position calculations

2. **funds**: Master catalog of funds we track/score/recommend
   - Subset of assets in client_holdings
   - Only contains funds we actively analyze and score
   - Used for scoring, recommendations, and fund-specific analytics

3. **trade_activity**: All buy/sell transactions
   - Used for flow analysis and trading patterns
   - Aggregated into materialized views for performance

### AUM Definitions

**CRITICAL**: The app uses two distinct AUM concepts that must not be confused:

#### 1. **Firm AUM** (Total Client Assets)
- **Definition**: Total market value of ALL client holdings across all advisors
- **Source**: `client_holdings` table aggregated
- **Includes**: Stocks, bonds, ETFs, mutual funds, REITs, etc. - everything
- **Used for**: 
  - Admin overview statistics
  - Total firm-level metrics
  - Individual advisor total AUM calculations
- **Example**: $964.5M (all client assets)

#### 2. **Tracked Fund AUM** (Fund-Specific Assets)
- **Definition**: Market value of holdings ONLY for funds in our `funds` table
- **Source**: `fund_utilization_mv` (client_holdings LEFT JOIN funds)
- **Includes**: Only ETFs/funds we actively track, score, and recommend
- **Used for**:
  - Dashboard fund-level AUM per ticker
  - Fund ownership and adoption metrics
  - Recommendation system calculations
- **Example**: $608M (only tracked/scored funds)

### Data Flow

```
client_holdings (ALL assets: $964.5M)
├── Direct aggregation → Firm AUM ($964.5M)
├── LEFT JOIN funds → fund_utilization_mv
│   └── Tracked Fund AUM ($608M)
└── Per-advisor filtering → Individual advisor positions
```

### Materialized Views

1. **advisor_metrics_mv**: Aggregates ALL holdings by advisor
   - Source: `client_holdings` 
   - AUM = Total value across all asset types
   
2. **fund_utilization_mv**: Aggregates holdings for tracked funds only
   - Source: `client_holdings LEFT JOIN funds`
   - AUM = Value only for funds in our catalog

3. **fund_flows_mv**: Trading activity by fund/month
   - Source: `trade_activity`
   - Used for flow analysis

## UI Components AUM Usage

- **Dashboard**: Should show Firm AUM ($964.5M) for total firm metrics
- **Portfolios by Advisor**: 
  - Total AUM KPI = Individual advisor's total holdings (Firm AUM subset)
  - Position column = Advisor's position in specific fund
  - Firm AUM column = Total firm holdings in that specific fund
- **Admin Overview**: Shows Firm AUM ($964.5M) - correct
- **Fund-level analysis**: Uses Tracked Fund AUM for fund-specific metrics

## Common Mistakes to Avoid

1. **Don't mix AUM concepts**: Dashboard was showing Tracked Fund AUM when it should show Firm AUM
2. **Don't assume all holdings are tracked funds**: Only ~60% of holdings are in our funds table
3. **Don't sum fund-level AUM to get firm total**: This double-counts multi-fund positions
4. **Individual advisor AUM ≠ sum of their tracked fund positions**: Advisor may hold untracked assets