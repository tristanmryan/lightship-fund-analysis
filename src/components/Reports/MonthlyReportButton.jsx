// src/components/Reports/MonthlyReportButton.jsx
import React, { useState } from 'react';
import { FileText, Download, FileSpreadsheet, Info } from 'lucide-react';
import { generatePDFReport, exportToExcel, exportToCSV, downloadFile, downloadPDF } from '../../services/exportService.js';
import { useFundData } from '../../hooks/useFundData';

const MonthlyReportButton = () => {
  const { funds, loading, error, asOfMonth } = useFundData();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState('');
  const [showPdfOptions, setShowPdfOptions] = useState(false);
  const [pdfScope, setPdfScope] = useState('all'); // 'all' | 'recommended'

  const handleGenerateReport = async (type, opts = {}) => {
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
      // Ensure as-of month is passed through for server-side shaping
      metadata.asOf = asOfMonth || (typeof window !== 'undefined' ? (window.__AS_OF_MONTH__ || null) : null);

      const reportData = { funds, metadata };
      const dateStr = new Date().toISOString().split('T')[0];

      switch (type) {
        case 'pdf':
          // Determine selection based on options
          const selectionScope = opts.scope || 'all';
          const highlightRecommended = selectionScope !== 'recommended';
          console.log('[UI] Generating PDF with scope:', selectionScope, {
            totalFunds: funds.length,
            recommended: funds.filter(f => f.is_recommended).length,
            asOf: metadata.asOf || null
          });
          const pdf = await generatePDFReport(reportData, {
            scope: selectionScope,
            highlightRecommended,
            landscape: true,
            includeTOC: true
          });
          const pdfFileName = `Raymond_James_Lightship_Report_${dateStr}.pdf`;
          downloadPDF(pdf, pdfFileName);
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
      
      // Provide user-friendly error messages
      let errorMessage = `Error generating ${type.toUpperCase()} report. `;
      
      if (error.message.includes('autoTable')) {
        errorMessage += 'PDF table generation failed. Please try again or contact support.';
      } else if (error.message.includes('font')) {
        errorMessage += 'Font loading failed. Please refresh and try again.';
      } else if (error.message.includes('memory')) {
        errorMessage += 'Report too large. Try filtering to fewer funds.';
      } else {
        errorMessage += 'Please check the console for details.';
      }
      
      alert(errorMessage);
    } finally {
      setIsGenerating(false);
      setGeneratingType('');
    }
  };

  const totalFunds = (funds || []).length;
  const recommendedCount = (funds || []).filter(f => f.is_recommended).length;

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
          <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f8fafc', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', color: '#374151' }}>Next Steps:</h4>
            <ol style={{ margin: '0 0 0 1.5rem', fontSize: '0.875rem', color: '#6b7280' }}>
              <li>Go to <strong>Admin</strong> tab to add recommended funds</li>
              <li>Assign asset classes to each fund</li>
              <li>Upload performance data in <strong>Admin → Data Import</strong></li>
              <li>Return here to generate professional PDF reports</li>
            </ol>
          </div>
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

      {/* Performance Data Status Indicator */}
      <div style={{ 
        marginTop: '1.5rem', 
        padding: '1rem', 
        backgroundColor: '#f0f9ff', 
        borderRadius: '0.5rem', 
        border: '1px solid #0ea5e9',
        borderLeft: '4px solid #0ea5e9'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Info size={16} style={{ color: '#0ea5e9' }} />
          <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '600', color: '#0c4a6e' }}>
            Performance Data Status
          </h4>
        </div>
        <div style={{ fontSize: '0.875rem', color: '#0c4a6e' }}>
          {(() => {
            const fundsWithPerformance = funds.filter(f => 
              f.ytd_return != null || f.one_year_return != null || f.three_year_return != null || f.five_year_return != null
            ).length;
            const fundsWithScores = funds.filter(f => f.score != null).length;
            
            if (fundsWithPerformance === 0) {
              return (
                <div>
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    <strong>No performance data available.</strong> PDF will show fund structure only.
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>
                    Upload performance data in Admin → Data Import to generate complete reports with scores and rankings.
                  </p>
                </div>
              );
            } else if (fundsWithScores === 0) {
              return (
                <div>
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    <strong>Partial performance data available.</strong> PDF will show returns but no scores.
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>
                    {fundsWithPerformance} of {funds.length} funds have performance data. Complete data upload needed for scoring.
                  </p>
                </div>
              );
            } else {
              return (
                <div>
                  <p style={{ margin: '0 0 0.5rem 0' }}>
                    <strong>Complete data available!</strong> PDF will include full analysis with scores and rankings.
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem' }}>
                    {fundsWithPerformance} of {funds.length} funds have performance data, {fundsWithScores} have calculated scores.
                  </p>
                </div>
              );
            }
          })()}
        </div>
      </div>

      <div className="export-buttons">
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
          gap: '1rem',
          marginBottom: '1rem'
        }}>
          {/* PDF Export - Primary Option */}
          <div style={{ 
            padding: '1.5rem', 
            border: '2px solid #002d72', 
            borderRadius: '0.5rem',
            backgroundColor: '#f8fafc',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <FileText size={32} style={{ color: '#002d72' }} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: '#002d72' }}>
              Professional PDF Report
            </h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.4' }}>
              Investment committee-ready report with Raymond James branding, asset class sections, and benchmark comparisons
            </p>
            <button
              onClick={() => setShowPdfOptions(true)}
              disabled={isGenerating}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#002d72',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              {getButtonIcon('pdf')}
              <span>{getButtonText('pdf')}</span>
            </button>
          </div>

          {/* Excel Export */}
          <div style={{ 
            padding: '1.5rem', 
            border: '1px solid #e5e7eb', 
            borderRadius: '0.5rem',
            backgroundColor: 'white',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <FileSpreadsheet size={32} style={{ color: '#059669' }} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: '#374151' }}>
              Excel Export
            </h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.4' }}>
              Spreadsheet format for further analysis and custom reporting
            </p>
            <button
              onClick={() => handleGenerateReport('excel')}
              disabled={isGenerating}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#059669',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              {getButtonIcon('excel')}
              <span>{getButtonText('excel')}</span>
            </button>
          </div>

          {/* CSV Export */}
          <div style={{ 
            padding: '1.5rem', 
            border: '1px solid #e5e7eb', 
            borderRadius: '0.5rem',
            backgroundColor: 'white',
            textAlign: 'center'
          }}>
            <div style={{ marginBottom: '1rem' }}>
              <Download size={32} style={{ color: '#6b7280' }} />
            </div>
            <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1rem', fontWeight: '600', color: '#374151' }}>
              CSV Export
            </h4>
            <p style={{ margin: '0 0 1rem 0', fontSize: '0.875rem', color: '#6b7280', lineHeight: '1.4' }}>
              Simple data export for external analysis tools
            </p>
            <button
              onClick={() => handleGenerateReport('csv')}
              disabled={isGenerating}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: '600',
                fontSize: '0.875rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                width: '100%',
                justifyContent: 'center'
              }}
            >
              {getButtonIcon('csv')}
              <span>{getButtonText('csv')}</span>
            </button>
          </div>
        </div>
      </div>
      
      <div className="export-info">
        <h4>Report Features:</h4>
        <ul>
          <li><strong>PDF Report:</strong> Professional Raymond James branded report with cover page, asset class tables, and performance metrics</li>
          <li><strong>Excel Report:</strong> Multi-sheet workbook with summary, all funds, recommended funds, and performance details</li>
          <li><strong>CSV Export:</strong> Simple data export for external analysis</li>
        </ul>
    </div>

      {/* PDF Export Options Modal */}
      {showPdfOptions && (
        <div className="modal-overlay" onClick={() => setShowPdfOptions(false)}>
          <div className="modal-content" role="dialog" aria-modal="true" aria-labelledby="pdf-options-title" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3 id="pdf-options-title">PDF Export Options</h3>
            </div>
            <div className="modal-body">
              <p style={{ color: '#6b7280', marginBottom: '0.75rem' }}>Choose which funds to include in the PDF report.</p>
              <div role="radiogroup" aria-label="PDF export scope" style={{ display: 'grid', gap: '0.5rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="pdf-scope"
                    value="all"
                    checked={pdfScope === 'all'}
                    onChange={() => setPdfScope('all')}
                  />
                  <span>All funds</span>
                  <span style={{ marginLeft: 'auto', color: '#6b7280' }}>{totalFunds} total</span>
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input
                    type="radio"
                    name="pdf-scope"
                    value="recommended"
                    checked={pdfScope === 'recommended'}
                    onChange={() => setPdfScope('recommended')}
                  />
                  <span>Recommended only</span>
                  <span style={{ marginLeft: 'auto', color: '#6b7280' }}>{recommendedCount} recommended</span>
                </label>
              </div>
              <div style={{ marginTop: '0.75rem', fontSize: '0.85rem', color: '#6b7280' }}>
                {pdfScope === 'recommended' ? (
                  <span>Note: Row highlighting is disabled when exporting recommended-only.</span>
                ) : (
                  <span>Recommended funds will be subtly highlighted.</span>
                )}
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowPdfOptions(false)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={async () => {
                  console.log('[UI] PDF modal confirmed. Scope selected:', pdfScope);
                  setShowPdfOptions(false);
                  await handleGenerateReport('pdf', { scope: pdfScope });
                }}
                disabled={isGenerating || (pdfScope === 'recommended' && recommendedCount === 0)}
                title={pdfScope === 'recommended' && recommendedCount === 0 ? 'No recommended funds available' : 'Generate PDF'}
              >
                Generate PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MonthlyReportButton;
