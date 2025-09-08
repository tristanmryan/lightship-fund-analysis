1. Check Core Tables Existence

[
  {
    "table_name": "activity_logs"
  },
  {
    "table_name": "alert_actions"
  },
  {
    "table_name": "alert_actions_backup"
  },
  {
    "table_name": "alert_rules"
  },
  {
    "table_name": "alert_rules_backup"
  },
  {
    "table_name": "alerts"
  },
  {
    "table_name": "alerts_backup"
  },
  {
    "table_name": "asset_class_benchmarks"
  },
  {
    "table_name": "asset_class_synonyms"
  },
  {
    "table_name": "asset_classes"
  },
  {
    "table_name": "benchmark_history"
  },
  {
    "table_name": "benchmark_performance"
  },
  {
    "table_name": "benchmarks"
  },
  {
    "table_name": "client_holdings"
  },
  {
    "table_name": "fund_overrides"
  },
  {
    "table_name": "fund_performance"
  },
  {
    "table_name": "fund_research_notes"
  },
  {
    "table_name": "funds"
  },
  {
    "table_name": "rpc_timings"
  },
  {
    "table_name": "scoring_profiles"
  },
  {
    "table_name": "scoring_weights"
  },
  {
    "table_name": "scoring_weights_audit"
  },
  {
    "table_name": "snapshots"
  },
  {
    "table_name": "trade_activity"
  },
  {
    "table_name": "user_sessions"
  },
  {
    "table_name": "users"
  }
]

2. Check RPC Functions (Critical)

[
  {
    "routine_name": "_apply_tiny_class_fallback",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_calculate_fund_scores",
    "routine_type": "FUNCTION",
    "return_type": "json"
  },
  {
    "routine_name": "_calculate_mean",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_calculate_metric_statistics",
    "routine_type": "FUNCTION",
    "return_type": "json"
  },
  {
    "routine_name": "_calculate_percentile",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_calculate_quantile",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_calculate_robust_scaling_anchors",
    "routine_type": "FUNCTION",
    "return_type": "json"
  },
  {
    "routine_name": "_calculate_single_fund_score",
    "routine_type": "FUNCTION",
    "return_type": "json"
  },
  {
    "routine_name": "_calculate_stddev",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_calculate_zscore",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_erf",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_erfinv",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_get_latest_fund_date",
    "routine_type": "FUNCTION",
    "return_type": "date"
  },
  {
    "routine_name": "_latest_fund_flow_month",
    "routine_type": "FUNCTION",
    "return_type": "date"
  },
  {
    "routine_name": "_scale_score",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_scale_score_robust",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "_winsorize_z",
    "routine_type": "FUNCTION",
    "return_type": "numeric"
  },
  {
    "routine_name": "acknowledge_alert",
    "routine_type": "FUNCTION",
    "return_type": "boolean"
  },
  {
    "routine_name": "assign_alert",
    "routine_type": "FUNCTION",
    "return_type": "boolean"
  },
  {
    "routine_name": "calculate_scores_as_of",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "forbid_update_delete",
    "routine_type": "FUNCTION",
    "return_type": "trigger"
  },
  {
    "routine_name": "get_active_month",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_advisor_adoption_trend",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_advisor_breakdown",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_advisor_metrics",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_advisor_participation",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_advisor_portfolio_allocation",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_advisor_positions",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_alerts",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_asset_class_table",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_compare_dataset",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_compare_dataset",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_flow_by_asset_class",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_fund_adoption_trend",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_fund_flows",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_fund_utilization",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_funds_as_of",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_history_for_tickers",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_latest_fund_performance",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_rpc_p95",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_scores_as_of",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_top_movers",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "get_trend_analytics",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "list_snapshot_counts",
    "routine_type": "FUNCTION",
    "return_type": "record"
  },
  {
    "routine_name": "log_activity",
    "routine_type": "FUNCTION",
    "return_type": "uuid"
  },
  {
    "routine_name": "refresh_advisor_adoption_mv",
    "routine_type": "FUNCTION",
    "return_type": "void"
  },
  {
    "routine_name": "refresh_advisor_metrics_mv",
    "routine_type": "FUNCTION",
    "return_type": "void"
  },
  {
    "routine_name": "refresh_alerts_for_month",
    "routine_type": "FUNCTION",
    "return_type": "integer"
  },
  {
    "routine_name": "refresh_alerts_for_month",
    "routine_type": "FUNCTION",
    "return_type": "integer"
  },
  {
    "routine_name": "refresh_fund_flows_mv",
    "routine_type": "FUNCTION",
    "return_type": "void"
  },
  {
    "routine_name": "refresh_fund_utilization_mv",
    "routine_type": "FUNCTION",
    "return_type": "void"
  },
  {
    "routine_name": "refresh_metric_stats_as_of",
    "routine_type": "FUNCTION",
    "return_type": "void"
  },
  {
    "routine_name": "resolve_alert",
    "routine_type": "FUNCTION",
    "return_type": "boolean"
  },
  {
    "routine_name": "scoring_weights_audit_fn",
    "routine_type": "FUNCTION",
    "return_type": "trigger"
  },
  {
    "routine_name": "update_fund_last_updated",
    "routine_type": "FUNCTION",
    "return_type": "trigger"
  },
  {
    "routine_name": "upsert_benchmark_performance",
    "routine_type": "FUNCTION",
    "return_type": "jsonb"
  },
  {
    "routine_name": "upsert_fund_performance",
    "routine_type": "FUNCTION",
    "return_type": "jsonb"
  },
  {
    "routine_name": "validate_csv_structure",
    "routine_type": "FUNCTION",
    "return_type": "jsonb"
  }
]

3. Check Function Signatures (Most Important)

[
  {
    "function_name": "calculate_scores_as_of",
    "arguments": "p_date date DEFAULT NULL::date, p_asset_class_id uuid DEFAULT NULL::uuid, p_global boolean DEFAULT false",
    "return_type": "TABLE(asset_class_id uuid, ticker text, name text, is_benchmark boolean, is_recommended boolean, score_raw numeric, score_final numeric, percentile numeric, metrics_used integer, total_possible_metrics integer, score_breakdown json, ytd_return numeric, one_year_return numeric, three_year_return numeric, five_year_return numeric, ten_year_return numeric, sharpe_ratio numeric, standard_deviation numeric, expense_ratio numeric, alpha numeric, beta numeric, up_capture_ratio numeric, down_capture_ratio numeric, manager_tenure numeric)"
  },
  {
    "function_name": "get_advisor_metrics",
    "arguments": "p_date date, p_advisor_id text DEFAULT NULL::text",
    "return_type": "TABLE(snapshot_date date, advisor_id text, client_count integer, unique_holdings integer, aum numeric)"
  },
  {
    "function_name": "get_asset_class_table",
    "arguments": "p_date date, p_asset_class_id uuid DEFAULT NULL::uuid, p_include_benchmark boolean DEFAULT true",
    "return_type": "TABLE(asset_class_id uuid, ticker text, name text, is_benchmark boolean, is_recommended boolean, perf_date date, ytd_return numeric, one_year_return numeric, three_year_return numeric, five_year_return numeric, ten_year_return numeric, sharpe_ratio numeric, standard_deviation_3y numeric, standard_deviation_5y numeric, expense_ratio numeric, beta numeric, alpha numeric, up_capture_ratio numeric, down_capture_ratio numeric, manager_tenure numeric, score_final numeric, percentile integer)"
  },
  {
    "function_name": "get_fund_flows",
    "arguments": "p_month date DEFAULT NULL::date, p_ticker text DEFAULT NULL::text, p_limit integer DEFAULT 100",
    "return_type": "TABLE(month date, ticker text, inflows numeric, outflows numeric, net_flow numeric, advisors_trading integer)"
  },
  {
    "function_name": "get_fund_utilization",
    "arguments": "p_date date, p_asset_class text DEFAULT NULL::text, p_limit integer DEFAULT 200",
    "return_type": "TABLE(snapshot_date date, ticker text, asset_class text, total_aum numeric, advisors_using integer, clients_using integer, avg_position_usd numeric)"
  },
  {
    "function_name": "get_funds_as_of",
    "arguments": "p_date date",
    "return_type": "TABLE(ticker text, name text, asset_class text, asset_class_id uuid, is_benchmark boolean, is_recommended boolean, ytd_return numeric, one_year_return numeric, three_year_return numeric, five_year_return numeric, ten_year_return numeric, sharpe_ratio numeric, standard_deviation numeric, standard_deviation_3y numeric, standard_deviation_5y numeric, expense_ratio numeric, alpha numeric, beta numeric, manager_tenure numeric, up_capture_ratio numeric, down_capture_ratio numeric, category_rank numeric, sec_yield numeric, fund_family text, perf_date date)"
  },
  {
    "function_name": "get_top_movers",
    "arguments": "p_month date DEFAULT NULL::date, p_direction text DEFAULT 'inflow'::text, p_asset_class text DEFAULT NULL::text, p_limit integer DEFAULT 10",
    "return_type": "TABLE(month date, ticker text, inflows numeric, outflows numeric, net_flow numeric, advisors_trading integer, asset_class text)"
  },
  {
    "function_name": "refresh_advisor_metrics_mv",
    "arguments": "",
    "return_type": "void"
  },
  {
    "function_name": "refresh_fund_flows_mv",
    "arguments": "",
    "return_type": "void"
  }
]

4. Check Key Table Structures

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO"
  },
  {
    "column_name": "ticker",
    "data_type": "character varying",
    "is_nullable": "NO"
  },
  {
    "column_name": "name",
    "data_type": "character varying",
    "is_nullable": "NO"
  },
  {
    "column_name": "asset_class",
    "data_type": "character varying",
    "is_nullable": "YES"
  },
  {
    "column_name": "is_recommended",
    "data_type": "boolean",
    "is_nullable": "YES"
  },
  {
    "column_name": "added_date",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES"
  },
  {
    "column_name": "removed_date",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES"
  },
  {
    "column_name": "notes",
    "data_type": "text",
    "is_nullable": "YES"
  },
  {
    "column_name": "last_updated",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES"
  },
  {
    "column_name": "asset_class_id",
    "data_type": "uuid",
    "is_nullable": "YES"
  },
  {
    "column_name": "is_benchmark",
    "data_type": "boolean",
    "is_nullable": "YES"
  }
]

5. Check fund_performance structure

[
  {
    "column_name": "id",
    "data_type": "uuid",
    "is_nullable": "NO"
  },
  {
    "column_name": "fund_ticker",
    "data_type": "character varying",
    "is_nullable": "YES"
  },
  {
    "column_name": "date",
    "data_type": "date",
    "is_nullable": "NO"
  },
  {
    "column_name": "ytd_return",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "one_year_return",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "three_year_return",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "five_year_return",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "ten_year_return",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "sharpe_ratio",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "standard_deviation",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "expense_ratio",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "alpha",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "beta",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "manager_tenure",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "created_at",
    "data_type": "timestamp with time zone",
    "is_nullable": "YES"
  },
  {
    "column_name": "up_capture_ratio",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "down_capture_ratio",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "category_rank",
    "data_type": "integer",
    "is_nullable": "YES"
  },
  {
    "column_name": "sec_yield",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "fund_family",
    "data_type": "character varying",
    "is_nullable": "YES"
  },
  {
    "column_name": "standard_deviation_3y",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "standard_deviation_5y",
    "data_type": "numeric",
    "is_nullable": "YES"
  },
  {
    "column_name": "perf_date",
    "data_type": "date",
    "is_nullable": "YES"
  }
]

6. Check Sample Data Availability

[
  {
    "asset_class_count": 32
  }
]

7. Test Critical RPC Execution

ERROR:  42703: column fp.ticker does not exist
HINT:  Perhaps you meant to reference the column "f.ticker".
QUERY:  SELECT json_agg(
      json_build_object(
        'ticker', f.ticker,
        'name', f.name,
        'asset_class_id', f.asset_class_id,
        'is_benchmark', COALESCE(f.is_benchmark, false),
        'is_recommended', COALESCE(f.is_recommended, false),
        'ytd_return', fp.ytd_return,
        'one_year_return', fp.one_year_return,
        'three_year_return', fp.three_year_return,
        'five_year_return', fp.five_year_return,
        'ten_year_return', fp.ten_year_return,
        'sharpe_ratio', fp.sharpe_ratio,
        'standard_deviation', fp.standard_deviation,
        'expense_ratio', fp.expense_ratio,
        'alpha', fp.alpha,
        'beta', fp.beta,
        'up_capture_ratio', fp.up_capture_ratio,
        'down_capture_ratio', fp.down_capture_ratio,
        'manager_tenure', fp.manager_tenure
      )
    )::text                          FROM funds f
    JOIN fund_performance fp ON f.ticker = fp.ticker AND fp.date = target_date
    WHERE f.asset_class_id = p_asset_class_id
CONTEXT:  PL/pgSQL function calculate_scores_as_of(date,uuid,boolean) line 31 at SQL statement
PL/pgSQL function calculate_scores_as_of(date,uuid,boolean) line 109 at FOR over SELECT rows

8. Check Ownership/Utilization Data

ERROR:  42883: function get_fund_ownership_summary() does not exist
LINE 2: SELECT * FROM get_fund_ownership_summary() LIMIT 5;
                      ^
HINT:  No function matches the given name and argument types. You might need to add explicit type casts.

9. Check for Materialized Views

[
  {
    "matviewname": "advisor_metrics_mv"
  },
  {
    "matviewname": "fund_flows_mv"
  },
  {
    "matviewname": "advisor_adoption_mv"
  },
  {
    "matviewname": "fund_utilization_mv"
  }
]

10. Check for Missing Expected Tables

[
  {
    "scoring_profiles": "EXISTS",
    "scoring_weights": "EXISTS",
    "fund_research_notes": "EXISTS",
    "benchmarks": "EXISTS",
    "benchmark_performance": "EXISTS",
    "client_holdings": "EXISTS",
    "client_trades": "MISSING"
  }
]