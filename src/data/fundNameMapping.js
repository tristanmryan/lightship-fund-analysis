// src/data/fundNameMapping.js
// Comprehensive fund name mapping for all funds in the system
// This ensures consistent, readable names for both recommended and non-recommended funds

export const fundNameMapping = {
  // Recommended Funds (from RecListFunds.csv)
  CAIFX: "American Funds Cap Inc Build",
  PRWCX: "T. Rowe Price Capital Appreciation",
  TIBIX: "Thornburg Inv Inc Builder",
  FCSZX: "Franklin Convertible Adv.",
  FZAEX: "Fidelity Adv. Emerging Markets Z",
  DODLX: "Dodge & Cox Global Bond I",
  MEDIX: "MFS Emerging Market Debt I",
  GSRTX: "Goldman Sachs Absolute Return Tracker Inv",
  JDJIX: "John Hancock Diversified Macro Fund",
  JHEQX: "JP Morgan Hedged Equity I",
  EIHIX: "Eaton Vance High Income Opp. I",
  MHYIX: "Mainstay High Yield I",
  DVHIX: "Delaware High Yield Muni",
  FEHIX: "First Eagle High Yield Muni I",
  MMHIX: "Mainstay High Yield Muni Bond I",
  EIHMX: "Eaton Vance National Muni Income I",
  GSMTX: "Goldman Sachs Dynamic Muni Inc. I",
  MTBIX: "Mainstay McKay Tax Free Bond I",
  STWTX: "Hartford Schroders Tax Aware Bond",
  FBKWX: "Fidelity Adv. Total Bond Z",
  LSIIX: "Loomis Sayles Investment Grade",
  UIITX: "Victory Core Plus Interm Bond",
  GSINX: "Goldman Sachs GQG Ptnrs Intl Opps I",
  IHDG: "WisdomTree Intl. Hedged Quality Div Growth ETF",
  JIGFX: "Janus Overseas I",
  MDIJX: "MFS Internation Diversification I",
  MQGIX: "MFS International Growth I",
  SCIEX: "Hartford Schroder's Intl. Stock I",
  TSWIX: "Transamerica Intl Equity",
  APDJX: "Artisan International Small Cap I",
  JEPI: "JP Morgan Equity Premium Income ETF",
  JQUA: "JP Morgan US Quality Factor ETF",
  PRDGX: "T. Rowe Price Dividend Growth",
  RSP: "Invesco Equal Weighted S&P 500 ETF",
  CEYIX: "Calvert Equity",
  FDYZX: "Franklin Dynatech Adv",
  MFEIX: "MFS Growth I",
  SPYG: "SPDR S&P 500 Growth ETF",
  TCAF: "T. Rowe Price Capital Appreciation ETF",
  WINN: "Harbor Long Term Growers",
  FDL: "First Trust Dividend Leaders ETF",
  PEIYX: "Putnam Large Cap Value Y",
  SCHD: "Schwab Strategic Trust ETF",
  SDY: "SPDR S&P Dividend",
  VYM: "Vanguard High Div ETF",
  CMNIX: "Calamos Market Neutral Income",
  CPLIX: "Calamos Phineus Long/Short I",
  HHCZX: "Nextpoint Event Driven",
  EIMAX: "Eaton Vance MA Tax free",
  MTALX: "MFS MA Muni Bond Fund",
  IJH: "iShares Core S&P Mid-Cap ETF",
  JHMM: "John Hancock Mid Cap Multifactor",
  TMCPX: "Touchstone Mid Cap Fund Y",
  FGSIX: "Federated Hermes MDT Mid Cap Growth IS",
  HLGEX: "JP Morgan Mid Cap Growth",
  JVMIX: "John Hancock Mid Cap Value I",
  XMVM: "Invesco S&S Midcap Value w/ Momentum ETF",
  PCOXX: "Federated Money Market",
  ESIIX: "Eaton Vance Strat Income I",
  JMSIX: "JP Morgan Income I",
  PMOYX: "Putnam Mortgage Opportunities",
  PONPX: "Pimco Income I2",
  PMFYX: "Pioneer Multi-Asset Income Y",
  TSHIX: "Transamerica Multi-Asset Income I",
  CPITX: "Counterpoint Tactical Income I",
  PFPNX: "Pimco Preferred & Cap Securities Fund I",
  FRIRX: "Fidelity Advisor Real Estate Income Z",
  MGLIX: "MFS Global Real Estate I",
  RRRRX: "Deutsche Real Estate S",
  ASFYX: "Virtus ASG Managed Futures Strat",
  BGSIX: "Blackrock Tech Opportunities I",
  BUYZ: "Franklin Disruptive Commerce ETF",
  EGIIX: "Eaton Vance Greater India",
  FDN: "First Trust Dow Jones Internet",
  FIJYX: "Fidelity Adv. Biotechnology Z",
  FIKAX: "Fidelity Adv. Energy Z",
  FIKCX: "Fidelity Advisor Healthcare Z",
  FTGC: "First Trust Global Tactical Commodity Strategy",
  GLIFX: "Lazard Global Infrastructure I",
  MMUIX: "MFS Utilities I",
  NXTG: "First Trust 5G ETF",
  QCLN: "First Trust Clean Energy ETF",
  QQQM: "Invesco Nasdaq 100 ETF",
  SKYY: "First Trust Cloud Computing ETF",
  XLK: "Tech Select Sector SPDR ETF",
  LDLFX: "Lord Abbett Short Duration F",
  LUBFX: "Lord Abbett Ultra Short F",
  MQLIX: "MFS Limited Maturity",
  ISHYX: "Invesco Short Duration High Yield Muni",
  MTLIX: "MFS Municipal Limited Maturity I",
  FCDIX: "Fidelity Adv. Stock Selector Small Cap",
  GACIX: "Gabelli Small Cap Growth",
  IVVIX: "Delaware IVY SMID core",
  IWM: "iShares Russell 2000 ETF",
  PSYGX: "Putnam Small Cap Growth Y",
  FCVIX: "Fidelity Adv. Small Cap Value Z",
  DRRIX: "BNY Mellon Global Real Return I",
  PFTPX: "PIMCO Low Duration Income I2",
  NEAR: "iShares Short Duration ETF",
  JPLD: "JPMorgan Limited Duration ETF",
  PRPFX: "Permanent Portfolio Fund I",
  IYGIX: "Maxquarie Large Cap Growth",
  VLIFX: "Value Line Mid Cap Focused",
  FEQZX: "Fidelity Advisor Hedged Equity",
  PRFRX: "T. Rowe Price Floating Rate",
  FIDI: "Fidelity International HY Dividend ETF",
  TIQIX: "Touchstone Non-US Equity Fund",

  // Non-Recommended Funds (cleaned up from NonRecListFunds.csv)
  WMFFX: "Washington Mutual Investors Fund",
  FZANX: "Fidelity Advisor New Insights Fund",
  GSFTX: "Columbia Dividend Income Fund",
  GFFFX: "American Funds Growth Fund of America",
  PIMIX: "PIMCO Income Fund",
  MEIIX: "MFS Value Fund",
  FTCS: "First Trust Capital Strength ETF",
  SEEGX: "JP Morgan Large Cap Growth Fund",
  NBPIX: "Neuberger Berman Large Cap Value Fund",
  SVBIX: "John Hancock Balanced Fund",
  HMEZX: "Nexpoint Merger Arbitrage Fund",
  VDIGX: "Vanguard Dividend Growth Fund",
  FVD: "First Trust Value Line Dividend Index Fund",
  FCNTX: "Fidelity Contrafund",
  GTEYX: "Gateway Fund",
  FBND: "Fidelity Total Bond ETF",
  FINFX: "American Funds Fundamental Investors Fund",
  FSSZX: "Fidelity Advisor Stock Selector Small Cap Fund",
  MDYG: "SPDR S&P 400 Mid Cap Growth ETF",
  MTFGX: "NYLI Mackay Strategic Muni Allocation Fund",
  AMEFX: "American Funds Income Fund of America",
  ANNPX: "Virtus Convertible Fund",
  JITIX: "JP Morgan National Municipal Income Fund",
  VEVIX: "Victory Sycamore Established Value Fund",
  SMGIX: "Columbia Contrarian Core Fund",
  WFMIX: "Allspring Special Mid Cap Value Fund",
  AUGW: "AllianzIM U.S. Large Cap Buffer 20AUG ETF",
  TRAIX: "T. Rowe Price Capital Appreciation Fund",
  PDGIX: "T. Rowe Price Dividend Growth Fund",
  FLMVX: "JP Morgan Mid Cap Value Fund",
  VIG: "Vanguard Dividend Appreciation ETF",
  JBALX: "Janus Henderson Balanced Fund",
  PPSIX: "Principal Spectrum Preferred and Capital Securities Fund",
  LCEYX: "Invesco Diversified Dividend Fund",
  BUFR: "FT Vest Laddered Buffer ETF",
  APRW: "AllianzIM U.S. Large Cap Buffer 20 APR ETF",
  APHJX: "Artisan International Small-Mid Fund",
  QUS: "SPDR MSCI USA Strategic Factors ETF",
  SMCFX: "American Funds Small Cap World Fund",
  MCNVX: "NYLI Mackay Convertible Fund",
  FIQSX: "Fidelity Advisor Floating Rate High Income Fund",
  JEPQ: "JP Morgan Nasdaq Equity Premium Income ETF",

  // Benchmark ETFs (from assetClassBenchmarks)
  AOM: "iShares Moderate Allocation",
  CWB: "Bloomberg Convertible Index",
  ACWX: "MSCI All Country World ex U.S.",
  BNDW: "Vanguard Total World Bond Index",
  QAI: "IQ Hedge Multi-Strat Index",
  AGG: "U.S. Aggregate Bond Index",
  HYD: "VanEck High Yield Muni Index",
  ITM: "VanEck Intermediate Muni Index",
  BSV: "Vanguard Short-Term Bond Index",
  EFA: "MSCI EAFE Index",
  SCZ: "MSCI EAFE Small-Cap Index",
  IWB: "Russell 1000",
  IWF: "Russell 1000 Growth",
  IWD: "Russell 1000 Value",
  IWR: "Russell Midcap Index",
  IWP: "Russell Midcap Growth Index",
  IWS: "Russell Midcap Value Index",
  BIL: "Bloomberg 1-3 Month T-Bill Index",
  PGX: "Invesco Preferred Index",
  RWO: "Dow Jones Global Real Estate Index",
  SPY: "S&P 500 Index",
  SUB: "iShares Short-Term Muni Index",
  VTWO: "Russell 2000",
  IWO: "Russell 2000 Growth",
  IWN: "Russell 2000 Value",
  AOR: "iShares Core Growth Allocation ETF"
};

/**
 * Get a clean, readable fund name from a symbol
 * @param {string} symbol - Fund symbol/ticker
 * @returns {string} Clean fund name or the original symbol if not found
 */
export function getFundDisplayName(symbol) {
  if (!symbol) return '';
  
  const cleanSymbol = symbol.toUpperCase().trim();
  return fundNameMapping[cleanSymbol] || symbol;
}

/**
 * Check if a fund has a clean name mapping
 * @param {string} symbol - Fund symbol/ticker
 * @returns {boolean} True if fund has a clean name mapping
 */
export function hasCleanName(symbol) {
  if (!symbol) return false;
  
  const cleanSymbol = symbol.toUpperCase().trim();
  return !!fundNameMapping[cleanSymbol];
}

/**
 * Get all funds that need name cleaning (don't have mappings)
 * @param {Array} fundSymbols - Array of fund symbols
 * @returns {Array} Array of symbols that need name cleaning
 */
export function getFundsNeedingNames(fundSymbols) {
  if (!Array.isArray(fundSymbols)) return [];
  
  return fundSymbols.filter(symbol => !hasCleanName(symbol));
} 