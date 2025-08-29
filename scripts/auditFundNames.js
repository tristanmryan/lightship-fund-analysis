#!/usr/bin/env node

// scripts/auditFundNames.js
// Utility script to audit fund names and identify funds needing name mapping

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getFundDisplayName, getFundsNeedingNames } from '../src/data/fundNameMapping.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Read CSV file and extract fund symbols
 */
function readFundSymbolsFromCSV(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const symbols = [];
    
    // Skip header row
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line) {
        const columns = line.split(',');
        if (columns[0]) {
          symbols.push(columns[0].trim());
        }
      }
    }
    
    return symbols;
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
    return [];
  }
}

/**
 * Audit fund names in a directory of CSV files
 */
function auditFundNames(csvDirectory) {
  console.log(`\n🔍 Auditing fund names in: ${csvDirectory}\n`);
  
  try {
    const files = fs.readdirSync(csvDirectory);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      console.log('No CSV files found in directory.');
      return;
    }
    
    const allSymbols = new Set();
    const filesWithSymbols = {};
    
    // Process each CSV file
    csvFiles.forEach(file => {
      const filePath = path.join(csvDirectory, file);
      const symbols = readFundSymbolsFromCSV(filePath);
      
      if (symbols.length > 0) {
        filesWithSymbols[file] = symbols;
        symbols.forEach(symbol => allSymbols.add(symbol));
      }
    });
    
    // Convert to arrays for processing
    const uniqueSymbols = Array.from(allSymbols).sort();
    
    console.log(`📊 Found ${uniqueSymbols.length} unique fund symbols across ${csvFiles.length} CSV files\n`);
    
    // Check which symbols have clean names
    const symbolsWithCleanNames = [];
    const symbolsNeedingNames = [];
    
    uniqueSymbols.forEach(symbol => {
      if (getFundDisplayName(symbol) !== symbol) {
        symbolsWithCleanNames.push(symbol);
      } else {
        symbolsNeedingNames.push(symbol);
      }
    });
    
    console.log(`✅ ${symbolsWithCleanNames.length} symbols have clean names`);
    console.log(`❌ ${symbolsNeedingNames.length} symbols need name mapping\n`);
    
    // Show funds that need names
    if (symbolsNeedingNames.length > 0) {
      console.log('🔴 Funds needing name mapping:');
      symbolsNeedingNames.forEach(symbol => {
        console.log(`   ${symbol}`);
      });
      console.log();
    }
    
    // Show sample of clean names
    if (symbolsWithCleanNames.length > 0) {
      console.log('🟢 Sample of funds with clean names:');
      symbolsWithCleanNames.slice(0, 10).forEach(symbol => {
        console.log(`   ${symbol} → ${getFundDisplayName(symbol)}`);
      });
      if (symbolsWithCleanNames.length > 10) {
        console.log(`   ... and ${symbolsWithCleanNames.length - 10} more`);
      }
      console.log();
    }
    
    // Show which files contain unmapped symbols
    if (symbolsNeedingNames.length > 0) {
      console.log('📁 Files containing unmapped symbols:');
      Object.entries(filesWithSymbols).forEach(([filename, symbols]) => {
        const unmappedInFile = symbols.filter(symbol => 
          symbolsNeedingNames.includes(symbol)
        );
        if (unmappedInFile.length > 0) {
          console.log(`   ${filename}: ${unmappedInFile.length} unmapped symbols`);
        }
      });
      console.log();
    }
    
    // Summary
    const coveragePercentage = ((symbolsWithCleanNames.length / uniqueSymbols.length) * 100).toFixed(1);
    console.log(`📈 Name mapping coverage: ${coveragePercentage}%`);
    
    if (symbolsNeedingNames.length > 0) {
      console.log(`\n💡 To complete the mapping, add entries for these symbols to src/data/fundNameMapping.js`);
    }
    
  } catch (error) {
    console.error('Error auditing fund names:', error.message);
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🚀 Fund Name Audit Tool');
  console.log('========================');
  
  // Default CSV directory
  const defaultCsvDir = path.join(__dirname, '..', 'data', 'fund-performance');
  
  // Check if directory exists
  if (fs.existsSync(defaultCsvDir)) {
    auditFundNames(defaultCsvDir);
  } else {
    console.log(`❌ Default CSV directory not found: ${defaultCsvDir}`);
    console.log('💡 Please run this script from the project root directory');
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
} 