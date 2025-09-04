# Recommended Page – User Guide

Path: `src/components/Recommended/RecommendedList.jsx`

## Overview

The Recommended page presents recommended funds grouped by asset class with ownership context (Firm AUM, # Advisors). Each table reuses the UnifiedFundTable with the `recommended` preset.

## Features

- Asset class filter at top (All or specific class).
- Grouped tables show:
  - Ticker, Name, Asset Class, Score, YTD, 1Y, Expense Ratio, Firm AUM, # Advisors, Recommended flag
- Benchmark rows styled distinctly.
- CSV export per asset class.

## Data Sources

- Funds + performance: Supabase RPC `get_funds_as_of` (via `fundService`).
- Ownership: `get_fund_ownership_summary` RPC when available; otherwise falls back to `get_fund_utilization` MV via RPC.

## Tips

- Click a fund row to inspect or deep-link to Portfolios → By Fund (optional enhancement).
- Ensure latest snapshot month is selected at the app header for consistent results.

