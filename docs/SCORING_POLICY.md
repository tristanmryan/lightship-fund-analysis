# Scoring Policy

- Core: weighted Z-score within asset class; scaled to 0–100 via 50 + 10x; clamped [0,100].
- Metrics: YTD, 1Y, 3Y, 5Y, 10Y, Sharpe (3Y), Std Dev (3Y/5Y), Up/Down Capture (3Y), Alpha (5Y), Expense Ratio, Manager Tenure.
- Weights: defaults in code; resolver may override. Class-level overrides optional in later phases.

## Feature flags (default OFF)
- REACT_APP_ENABLE_WINSORIZATION: clamp extreme Z-values (approx 1st/99th percentile) to reduce outlier impact.
- REACT_APP_ENABLE_TINY_CLASS_FALLBACK: when peer sample is thin, shrink raw effects or neutralize to avoid unstable scores.
  - Tunables: REACT_APP_TINY_CLASS_MIN_PEERS, REACT_APP_TINY_CLASS_NEUTRAL_THRESHOLD, REACT_APP_TINY_CLASS_SHRINK.

## Missing metrics
- Default policy: reweight present metrics proportionally.
- Optional: small penalty per missing metric (disabled).

## Rationale
- Drilldown shows top contributors; Funds badges show top positives and one negative if score < 45.
- Tooltip summarizer lists top three contributors compactly (hover on badges in Funds table).

## Trust guidance
- Aim for ≥80% coverage across YTD, 1Y, Sharpe (3Y), Std Dev (3Y) before relying on scores.
- Non-EOM months may be incomplete; convert to EOM for consistency.

See also
- Advisor glossary: [docs/advisor_glossary.md](./advisor_glossary.md)