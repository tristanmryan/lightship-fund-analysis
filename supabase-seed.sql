-- Supabase Seed and Backfill for Asset Class Dictionary
-- Run this after applying supabase-schema-fixed.sql

-- 1) Seed asset_classes (examples; extend as needed)
INSERT INTO asset_classes (code, name, description, group_name, sort_group, sort_order)
VALUES
 ('LARGE_CAP_GROWTH','Large Cap Growth',NULL,'U.S. Equity',1,110),
 ('LARGE_CAP_VALUE','Large Cap Value',NULL,'U.S. Equity',1,120),
 ('LARGE_CAP_BLEND','Large Cap Blend',NULL,'U.S. Equity',1,130),
 ('MID_CAP_GROWTH','Mid-Cap Growth',NULL,'U.S. Equity',1,210),
 ('MID_CAP_VALUE','Mid-Cap Value',NULL,'U.S. Equity',1,230),
 ('SMALL_CAP_GROWTH','Small Cap Growth',NULL,'U.S. Equity',1,310),
 ('SMALL_CAP_VALUE','Small Cap Value',NULL,'U.S. Equity',1,330),
 ('SMALL_CAP_CORE','Small Cap Core',NULL,'U.S. Equity',1,320),
 ('INTERNATIONAL_LARGE','International Stock (Large Cap)',NULL,'International Equity',2,110),
 ('INTERNATIONAL_SMCAP','International Stock (Small/Mid Cap)',NULL,'International Equity',2,120),
 ('EMERGING_MARKETS','Emerging Markets',NULL,'International Equity',2,130),
 ('MONEY_MARKET','Money Market',NULL,'Fixed Income',3,10),
 ('SHORT_TERM_MUNI','Short Term Muni',NULL,'Fixed Income',3,20),
 ('INTERMEDIATE_MUNI','Intermediate Muni',NULL,'Fixed Income',3,30),
 ('HIGH_YIELD_MUNI','High Yield Muni',NULL,'Fixed Income',3,40),
 ('MASS_MUNI_BONDS','Mass Muni Bonds',NULL,'Fixed Income',3,45),
 ('SHORT_TERM_BONDS','Short Term Bonds',NULL,'Fixed Income',3,50),
 ('INTERMEDIATE_TERM_BONDS','Intermediate Term Bonds',NULL,'Fixed Income',3,60),
 ('HIGH_YIELD_BONDS','High Yield Bonds',NULL,'Fixed Income',3,70),
 ('FOREIGN_BONDS','Foreign Bonds',NULL,'Fixed Income',3,80),
 ('MULTI_SECTOR_BONDS','Multi Sector Bonds',NULL,'Fixed Income',3,90),
 ('NON_TRADITIONAL_BONDS','Non-Traditional Bonds',NULL,'Fixed Income',3,100),
 ('CONVERTIBLE_BONDS','Convertible Bonds',NULL,'Fixed Income',3,110),
 ('MULTI_ASSET_INCOME','Multi-Asset Income',NULL,'Alternative Investments',4,10),
 ('PREFERRED_STOCK','Preferred Stock',NULL,'Alternative Investments',4,20),
 ('LONG_SHORT','Long/Short',NULL,'Alternative Investments',4,30),
 ('REAL_ESTATE','Real Estate',NULL,'Alternative Investments',4,40),
 ('HEDGED_ENHANCED','Hedged/Enhanced',NULL,'Alternative Investments',4,50),
 ('TACTICAL','Tactical',NULL,'Alternative Investments',4,60),
 ('ASSET_ALLOCATION','Asset Allocation',NULL,'Alternative Investments',4,70),
 ('SECTOR_FUNDS','Sector Funds',NULL,'Sector Funds',5,10)
ON CONFLICT (code) DO NOTHING;

-- 2) Seed synonyms (map labels to codes; add more as needed)
INSERT INTO asset_class_synonyms (code, label)
SELECT ac.code, ac.name FROM asset_classes ac
ON CONFLICT (label) DO NOTHING;

-- Additional specific synonyms
INSERT INTO asset_class_synonyms (code, label) VALUES
 ('INTERNATIONAL_LARGE','International (Large Cap)'),
 ('INTERNATIONAL_SMCAP','International (Small/Mid Cap)')
ON CONFLICT (label) DO NOTHING;

-- 3) Ensure benchmark definitions exist with proxy_type/source
-- (Add or upsert common ETFs used as proxies)
INSERT INTO benchmarks (ticker, name, proxy_type, source)
VALUES
 ('IWF','Russell 1000 Growth','ETF','seed'),
 ('IWD','Russell 1000 Value','ETF','seed'),
 ('IWB','Russell 1000','ETF','seed'),
 ('IWP','Russell Mid Cap Growth','ETF','seed'),
 ('IWS','Russell Mid Cap Value','ETF','seed'),
 ('IWO','Russell 2000 Growth','ETF','seed'),
 ('IWN','Russell 2000 Value','ETF','seed'),
 ('VTWO','Russell 2000','ETF','seed'),
 ('EFA','MSCI EAFE Index','ETF','seed'),
 ('SCZ','MSCI EAFE Small-Cap Index','ETF','seed'),
 ('ACWX','MSCI ACWI ex US','ETF','seed'),
 ('AGG','U.S. Aggregate Bond Index','ETF','seed'),
 ('HYD','VanEck High Yield Muni Index','ETF','seed'),
 ('ITM','VanEck Intermediate Muni Index','ETF','seed'),
 ('BSV','Vanguard Short-Term Bond Index','ETF','seed'),
 ('SUB','iShares Short-Term Muni Index','ETF','seed'),
 ('PGX','Invesco Preferred Index','ETF','seed'),
 ('RWO','Dow Jones Global Real Estate Index','ETF','seed'),
 ('SPY','S&P 500 Index','ETF','seed'),
 ('AOM','iShares Moderate Allocation','ETF','seed'),
 ('QAI','IQ Hedge Multi-Strat Index','ETF','seed'),
 ('AOR','iShares Core Growth Allocation ETF','ETF','seed')
ON CONFLICT (ticker) DO NOTHING;

-- 4) Map asset classes to primary benchmarks (kind='primary')
-- Uses labels from src/data/config.js as of current app
INSERT INTO asset_class_benchmarks (asset_class_id, benchmark_id, kind, rank)
SELECT ac.id, b.id, 'primary', 1
FROM asset_classes ac
JOIN LATERAL (
  SELECT * FROM benchmarks WHERE (
    (ac.code = 'ASSET_ALLOCATION' AND ticker='AOM') OR
    (ac.code = 'CONVERTIBLE_BONDS' AND ticker='CWB') OR
    (ac.code = 'EMERGING_MARKETS' AND ticker='ACWX') OR
    (ac.code = 'FOREIGN_BONDS' AND ticker='BNDW') OR
    (ac.code = 'HEDGED_ENHANCED' AND ticker='QAI') OR
    (ac.code = 'HIGH_YIELD_BONDS' AND ticker='AGG') OR
    (ac.code = 'HIGH_YIELD_MUNI' AND ticker='HYD') OR
    (ac.code = 'INTERMEDIATE_MUNI' AND ticker='ITM') OR
    (ac.code = 'INTERMEDIATE_TERM_BONDS' AND ticker='AGG') OR
    (ac.code = 'INTERNATIONAL_LARGE' AND ticker='EFA') OR
    (ac.code = 'INTERNATIONAL_SMCAP' AND ticker='SCZ') OR
    (ac.code = 'LARGE_CAP_BLEND' AND ticker='IWB') OR
    (ac.code = 'LARGE_CAP_GROWTH' AND ticker='IWF') OR
    (ac.code = 'LARGE_CAP_VALUE' AND ticker='IWD') OR
    (ac.code = 'LONG_SHORT' AND ticker='QAI') OR
    (ac.code = 'MASS_MUNI_BONDS' AND ticker='ITM') OR
    (ac.code = 'MID_CAP_BLEND' AND ticker='IWR') OR
    (ac.code = 'MID_CAP_GROWTH' AND ticker='IWP') OR
    (ac.code = 'MID_CAP_VALUE' AND ticker='IWS') OR
    (ac.code = 'MONEY_MARKET' AND ticker='BIL') OR
    (ac.code = 'MULTI_SECTOR_BONDS' AND ticker='AGG') OR
    (ac.code = 'MULTI_ASSET_INCOME' AND ticker='AOM') OR
    (ac.code = 'NON_TRADITIONAL_BONDS' AND ticker='AGG') OR
    (ac.code = 'PREFERRED_STOCK' AND ticker='PGX') OR
    (ac.code = 'REAL_ESTATE' AND ticker='RWO') OR
    (ac.code = 'SECTOR_FUNDS' AND ticker='SPY') OR
    (ac.code = 'SHORT_TERM_BONDS' AND ticker='BSV') OR
    (ac.code = 'SHORT_TERM_MUNI' AND ticker='SUB') OR
    (ac.code = 'SMALL_CAP_CORE' AND ticker='VTWO') OR
    (ac.code = 'SMALL_CAP_GROWTH' AND ticker='IWO') OR
    (ac.code = 'SMALL_CAP_VALUE' AND ticker='IWN') OR
    (ac.code = 'TACTICAL' AND ticker='AOR')
  ) LIMIT 1
) b ON TRUE
ON CONFLICT DO NOTHING;

-- 5) Backfill funds.asset_class_id from funds.asset_class via synonyms/name
UPDATE funds f
SET asset_class_id = ac.id
FROM asset_classes ac
LEFT JOIN asset_class_synonyms syn ON syn.code = ac.code
WHERE f.asset_class_id IS NULL
  AND (
    LOWER(f.asset_class) = LOWER(ac.name) OR
    LOWER(f.asset_class) = LOWER(syn.label)
  );

-- 6) Report unresolved funds
SELECT ticker, name, asset_class
FROM funds
WHERE asset_class_id IS NULL
ORDER BY ticker;

