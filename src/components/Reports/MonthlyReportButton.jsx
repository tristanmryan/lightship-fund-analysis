// src/components/Reports/MonthlyReportButton.jsx
import React, { useState } from 'react';
import { FileText, Download, FileSpreadsheet } from 'lucide-react';
import { generatePDFReport, exportToExcel, exportToCSV, downloadFile } from '../../services/exportService';
import { useFundData } from '../../hooks/useFundData';

const MonthlyReportButton = () => {
  const { funds, loading, error } = useFundData();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState('');

  const handleGenerateReport = async (type) => {
    if (loading || funds.length === 0) {
      alert('Please wait for fund data to load or add some funds first.');
      return;
    }

    setIsGenerating(true);
    setGeneratingType(type);
    
    try {
      const metadata = {
        date: new Date().toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        }),
        totalFunds: funds.length,
        recommendedFunds: funds.filter(f => f.is_recommended).length,
        assetClassCount: new Set(funds.map(f => f.asset_class).filter(Boolean)).size,
        averagePerformance: calculateAveragePerformance(funds)
      };

      const reportData = { funds, metadata };
      const dateStr = new Date().toISOString().split('T')[0];

      switch (type) {
        case 'pdf':
          const pdf = generatePDFReport(reportData);
          const pdfFileName = `Raymond_James_Lightship_Report_${dateStr}.pdf`;
          pdf.save(pdfFileName);
          break;

        case 'excel':
          const excelBlob = exportToExcel(reportData);
          const excelFileName = `Raymond_James_Lightship_Report_${dateStr}.xlsx`;
          downloadFile(excelBlob, excelFileName, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
          break;

        case 'csv':
          const csvBlob = exportToCSV(funds);
          const csvFileName = `Raymond_James_Lightship_Report_${dateStr}.csv`;
          downloadFile(csvBlob, csvFileName, 'text/csv');
          break;

        default:
          throw new Error(`Unknown export type: ${type}`);
      }

      console.log(`Successfully generated ${type.toUpperCase()} report`);
    } catch (error) {
      console.error(`Error generating ${type} report:`, error);
      alert(`Error generating ${type.toUpperCase()} report. Please check the console for details.`);
    } finally {
      setIsGenerating(false);
      setGeneratingType('');
    }
  };

  // Calculate average performance
  const calculateAveragePerformance = (funds) => {
    const validReturns = funds.map(f => f.ytd_return).filter(v => v != null && !isNaN(v));
    if (validReturns.length === 0) return null;
    return validReturns.reduce((sum, val) => sum + val, 0) / validReturns.length;
  };

  const getButtonText = (type) => {
    if (isGenerating && generatingType === type) {
      return `Generating ${type.toUpperCase()}...`;
    }
    return `Export ${type.toUpperCase()}`;
  };

  const getButtonIcon = (type) => {
    if (isGenerating && generatingType === type) {
      return <div className="loading-spinner small"></div>;
    }
    
    switch (type) {
      case 'pdf':
        return <FileText size={16} />;
      case 'excel':
        return <FileSpreadsheet size={16} />;
      case 'csv':
        return <Download size={16} />;
      default:
        return <Download size={16} />;
    }
  };

  if (loading) {
    return (
      <div className="export-section">
        <div className="loading-spinner"></div>
        <p>Loading fund data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="export-section">
        <div className="error-message">
          <p>Error loading fund data: {error}</p>
        </div>
      </div>
    );
  }

  if (funds.length === 0) {
    return (
      <div className="export-section">
        <div className="empty-state">
          <FileText size={48} />
          <h3>No Funds Available</h3>
          <p>Add some funds to your list to generate reports.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="export-section">
      <div className="export-header">
        <h3>Export Reports</h3>
        <p className="subtitle">
          Generate professional reports with Raymond James branding
        </p>
      </div>

      <div className="export-stats">
        <div className="stat-item">
          <span className="stat-value">{funds.length}</span>
          <span className="stat-label">Total Funds</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{funds.filter(f => f.is_recommended).length}</span>
          <span className="stat-label">Recommended</span>
        </div>
        <div className="stat-item">
          <span className="stat-value">{new Set(funds.map(f => f.asset_class).filter(Boolean)).size}</span>
          <span className="stat-label">Asset Classes</span>
        </div>
      </div>

      <div className="export-buttons">
        <button
          onClick={() => handleGenerateReport('pdf')}
          disabled={isGenerating}
          className="btn btn-primary export-btn"
        >
          {getButtonIcon('pdf')}
          {getButtonText('pdf')}
        </button>

        <button
          onClick={() => handleGenerateReport('excel')}
          disabled={isGenerating}
          className="btn btn-secondary export-btn"
        >
          {getButtonIcon('excel')}
          {getButtonText('excel')}
        </button>

        <button
          onClick={() => handleGenerateReport('csv')}
          disabled={isGenerating}
          className="btn btn-outline export-btn"
        >
          {getButtonIcon('csv')}
          {getButtonText('csv')}
        </button>
      </div>

      <div className="export-info">
        <h4>Report Features:</h4>
        <ul>
          <li><strong>PDF Report:</strong> Professional Raymond James branded report with cover page, asset class tables, and performance metrics</li>
          <li><strong>Excel Report:</strong> Multi-sheet workbook with summary, all funds, recommended funds, and performance details</li>
          <li><strong>CSV Export:</strong> Simple data export for external analysis</li>
        </ul>
      </div>
    </div>
  );
};

export default MonthlyReportButton;