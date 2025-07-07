// src/components/Reports/MonthlyReportButton.jsx
import React, { useState } from 'react';
import { FileText, Download, Loader } from 'lucide-react';
import { generateMonthlyReport } from '../../services/pdfReportService';
import assetClassGroups from '../../data/assetClassGroups';

const MonthlyReportButton = ({ 
  fundData, 
  benchmarkData, 
  metadata,
  assetClassBenchmarks 
}) => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    
    try {
      // Prepare report data
      const reportData = {
        funds: fundData,
        benchmarks: prepareBenchmarkData(benchmarkData, assetClassBenchmarks),
        assetClassGroups: assetClassGroups,
        metadata: {
          ...metadata,
          date: metadata.date || new Date().toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
          }),
          totalFunds: fundData.length,
          recommendedFunds: fundData.filter(f => f.isRecommended).length,
          assetClassCount: new Set(fundData.map(f => f['Asset Class'])).size,
          averageScore: calculateAverageScore(fundData)
        }
      };

      // Generate PDF
      const pdf = generateMonthlyReport(reportData);
      
      // Download PDF
      const fileName = `Lightship_Performance_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      pdf.save(fileName);
      
    } catch (error) {
      console.error('Error generating report:', error);
      alert('Error generating report. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Prepare benchmark data with proper structure
  const prepareBenchmarkData = (benchmarkData, benchmarkMappings) => {
    const prepared = {};
    
    Object.entries(benchmarkMappings).forEach(([assetClass, { ticker, name }]) => {
      const benchmarkFund = Object.values(benchmarkData).find(b => b.Symbol === ticker);
      if (benchmarkFund) {
        prepared[assetClass] = {
          ticker,
          name,
          ...benchmarkFund
        };
      }
    });
    
    return prepared;
  };

  // Calculate average score
  const calculateAverageScore = (funds) => {
    const scores = funds.map(f => f.scores?.final).filter(s => s != null);
    if (scores.length === 0) return 'N/A';
    const avg = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    return avg.toFixed(1);
  };

  return (
    <button
      onClick={handleGenerateReport}
      disabled={isGenerating || !fundData || fundData.length === 0}
      style={{
        padding: '0.75rem 1.5rem',
        backgroundColor: '#7c3aed',
        color: 'white',
        border: 'none',
        borderRadius: '0.5rem',
        cursor: isGenerating || !fundData?.length ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem',
        fontSize: '0.9375rem',
        fontWeight: '500',
        opacity: isGenerating || !fundData?.length ? 0.6 : 1,
        transition: 'all 0.2s',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}
      onMouseEnter={(e) => {
        if (!isGenerating && fundData?.length) {
          e.target.style.backgroundColor = '#6d28d9';
          e.target.style.boxShadow = '0 4px 8px rgba(0,0,0,0.15)';
        }
      }}
      onMouseLeave={(e) => {
        e.target.style.backgroundColor = '#7c3aed';
        e.target.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
      }}
      title="Generate PDF report matching your Excel format"
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