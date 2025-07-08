// src/components/Reports/MonthlyReportButton.jsx
import React, { useState } from 'react';
import { FileText, Loader } from 'lucide-react';
import { generateMonthlyReport } from '../../services/pdfReportService';
import assetClassGroups from '../../data/assetClassGroups';

const MonthlyReportButton = ({ 
  fundData, 
  metadata,
  assetClassBenchmarks 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
    try {
      // Prepare benchmark data by extracting from fundData
      const benchmarkData = prepareBenchmarkData(fundData, assetClassBenchmarks);
      
      // Filter out benchmarks from the main fund list for the report
      const benchmarkTickers = new Set(Object.values(assetClassBenchmarks).map(b => b.ticker));
      const nonBenchmarkFunds = fundData.filter(f => !benchmarkTickers.has(f.Symbol));
      
      // Prepare report data
      const reportData = {
        funds: nonBenchmarkFunds,
        benchmarks: benchmarkData,
        metadata: {
          ...metadata,
          date: metadata?.date || new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          totalFunds: fundData.length,
          recommendedFunds: fundData.filter(f => f.isRecommended).length,
          assetClassCount: new Set(fundData.map(f => f['Asset Class']).filter(Boolean)).size,
          averageScore: calculateAverageScore(fundData.filter(f => f.isRecommended))
        }
      };

      // Generate PDF
      const pdf = generateMonthlyReport(reportData);
      
      // Download PDF with proper filename
      const dateStr = new Date().toISOString().split('T')[0];
      const fileName = `Lightship_Performance_Report_${dateStr}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please check the console for details.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Extract benchmark data from the fund list
  const prepareBenchmarkData = (allFunds, benchmarkMappings) => {
    const prepared = {};

    const clean = (s) => s?.toUpperCase().trim();

    Object.entries(benchmarkMappings).forEach(([assetClass, benchmarkInfo]) => {
      // Find the benchmark fund in the data using a cleaned ticker match
      const ticker = clean(benchmarkInfo.ticker);
      const benchmarkFund = allFunds.find(f => clean(f.Symbol) === ticker);

      if (benchmarkFund) {
        prepared[assetClass] = {
          ticker: benchmarkInfo.ticker,
          name: benchmarkInfo.name,
          ...benchmarkFund
        };
      }
    });

    return prepared;
  };

  // Calculate average score for recommended funds only
  const calculateAverageScore = (funds) => {
    const scores = funds
      .map(f => f.scores?.final)
      .filter(s => s != null && s > 0);
    
    if (scores.length === 0) return 'N/A';
    
    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return avg.toFixed(1);
  };

  return (
    <button
      onClick={handleGenerateReport}
      disabled={isGenerating || !fundData || fundData.length === 0}
      className="monthly-report-button"
      style={{
        padding: '0.75rem 1.5rem',
        backgroundColor: isGenerating || !fundData?.length ? '#9ca3af' : '#7c3aed',
        color: 'white',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: isGenerating || !fundData?.length ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.9375rem',
        fontWeight: '500',
        opacity: isGenerating || !fundData?.length ? 0.7 : 1,
        transition: 'all 0.2s ease',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
      onMouseEnter={(e) => {
        if (!isGenerating && fundData?.length) {
          e.currentTarget.style.backgroundColor = '#6d28d9';
          e.currentTarget.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isGenerating && fundData?.length) {
          e.currentTarget.style.backgroundColor = '#7c3aed';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
        }
      }}
      title={
        !fundData?.length 
          ? "Please load fund data first" 
          : "Generate PDF report matching your Excel format"
      }
    >
      {isGenerating ? (
        <>
          <Loader size={18} className="animate-spin" />
          Generating Report...
        </>
      ) : (
        <>
          <FileText size={18} />
          Generate Monthly Report
        </>
      )}
    </button>
  );
};

export default MonthlyReportButton;