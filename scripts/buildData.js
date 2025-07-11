// scripts/buildData.js
const fs = require('fs');
const path = require('path');
const Papa = require('papaparse');

(async () => {
  const { processRawFunds } = await import('../src/services/fundProcessor.js');
  const { recommendedFunds, assetClassBenchmarks } = await import('../src/data/config.js');

console.log('🚀 Starting data processing...');

// Check if fund-performance folder exists and has CSV files
const fundPerfFolder = './data/fund-performance/';
if (!fs.existsSync(fundPerfFolder)) {
  console.log('❌ Fund performance folder not found');
  process.exit(1);
}

const csvFiles = fs.readdirSync(fundPerfFolder).filter(file => file.endsWith('.csv'));
if (csvFiles.length === 0) {
  console.log('❌ No CSV files found in fund-performance folder');
  process.exit(1);
}

console.log(`📁 Found ${csvFiles.length} CSV files`);

// Process each CSV file
const snapshots = {};

function clean(s) {
  return s?.toUpperCase().trim().replace(/[^A-Z0-9]/g, '');
}

function extractDateFromFilename(filename) {
  // Match patterns like "June2024_FundPerformance.csv"
  const monthNames = {
    'january': '01', 'february': '02', 'march': '03', 'april': '04',
    'may': '05', 'june': '06', 'july': '07', 'august': '08',
    'september': '09', 'october': '10', 'november': '11', 'december': '12'
  };
  
  const match = filename.match(/(\w+)(\d{4})/i);
  if (match && monthNames[match[1].toLowerCase()]) {
    return {
      year: match[2],
      month: monthNames[match[1].toLowerCase()]
    };
  }
  
  console.log(`⚠️  Could not extract date from ${filename}, skipping`);
  return null;
}

for (const file of csvFiles) {
  console.log(`📊 Processing ${file}...`);
  
  try {
    const filePath = path.join(fundPerfFolder, file);
    const csvContent = fs.readFileSync(filePath, 'utf8');
    
    // Extract date from filename
    const dateInfo = extractDateFromFilename(file);
    if (!dateInfo) continue;
    
    // Parse CSV
    const parsed = Papa.parse(csvContent, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true
    });
    
    // Convert to app format
    const funds = parsed.data.map(fund => ({
      Symbol: clean(fund['Symbol/CUSIP']),
      "YTD": fund['Total Return - YTD (%)'],
      "1 Year": fund['Total Return - 1 Year (%)'],
      "3 Year": fund['Annualized Total Return - 3 Year (%)'],
      "5 Year": fund['Annualized Total Return - 5 Year (%)'],
      "10 Year": fund['Annualized Total Return - 10 Year (%)'],
      "Alpha": fund['Alpha (Asset Class) - 5 Year'],
      "StdDev5Y": fund['Standard Deviation - 5 Year'],
      "StdDev3Y": fund['Standard Deviation - 3 Year'],
      "Sharpe Ratio": fund['Sharpe Ratio - 3 Year'],
      "Net Expense Ratio": fund['Net Exp Ratio (%)'],
      "Manager Tenure": fund['Longest Manager Tenure (Years)'],
      "SEC Yield": fund['SEC Yield (%)'],
      "Up Capture": fund['Up Capture Ratio (Morningstar Standard) - 3 Year'],
      "Down Capture": fund['Down Capture Ratio (Morningstar Standard) - 3 Year']
    })).filter(fund => fund.Symbol);

    const { scoredFunds, classSummaries, benchmarks } = processRawFunds(funds, {
      recommendedFunds,
      benchmarks: assetClassBenchmarks
    });

    const snapshotId = `snapshot_${dateInfo.year}_${dateInfo.month}`;
    const snapshot = {
      id: snapshotId,
      date: `${dateInfo.year}-${dateInfo.month}-30T00:00:00.000Z`,
      funds: scoredFunds,
      classSummaries,
      metadata: {
        uploadDate: `${dateInfo.year}-${dateInfo.month}-30T00:00:00.000Z`,
        uploadedBy: "system",
        totalFunds: scoredFunds.length,
        fileName: file,
        source: "historical_data"
      },
      benchmarks
    };

    snapshots[snapshotId] = snapshot;
    console.log(`  ✅ Processed ${scoredFunds.length} funds for ${dateInfo.year}-${dateInfo.month}`);
    
  } catch (error) {
    console.log(`  ❌ Error processing ${file}:`, error.message);
  }
}

// Generate JavaScript file
const jsContent = `// src/data/historicalSnapshots.js
// Auto-generated historical fund performance data
// Generated on: ${new Date().toISOString()}
// Total snapshots: ${Object.keys(snapshots).length}

export const HISTORICAL_SNAPSHOTS = ${JSON.stringify(snapshots, null, 2)};

// Helper functions
export const getAllHistoricalSnapshots = () => {
  return Object.values(HISTORICAL_SNAPSHOTS);
};

export const getHistoricalSnapshot = (snapshotId) => {
  return HISTORICAL_SNAPSHOTS[snapshotId];
};

export const getHistoricalSnapshotsByDateRange = (startDate, endDate) => {
  return getAllHistoricalSnapshots().filter(snapshot => {
    const snapshotDate = new Date(snapshot.date);
    return snapshotDate >= new Date(startDate) && snapshotDate <= new Date(endDate);
  });
};

export const getLatestSnapshot = () => {
  const snapshots = getAllHistoricalSnapshots();
  return snapshots.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
};
`;

// Create src/data directory if it doesn't exist
const dataDir = './src/data/';
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Write the JavaScript file
fs.writeFileSync('./src/data/historicalSnapshots.js', jsContent);

console.log(`\n🎉 Processing complete!`);
console.log(`📊 Generated ${Object.keys(snapshots).length} snapshots`);
console.log(`📁 Created: src/data/historicalSnapshots.js`);
console.log(`\nNext step: npm start to test!`);

})();