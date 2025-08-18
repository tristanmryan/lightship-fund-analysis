/**
 * PDF Generation Status Component
 * Provides user feedback during PDF generation with progress indicators and error handling
 */

import React, { useState, useCallback } from 'react';
import { FileText, AlertCircle, CheckCircle, Loader, Download } from 'lucide-react';
import { generatePDFReport, downloadPDF } from '../services/exportService';

/**
 * PDF Generation Status Hook
 * Manages PDF generation state and provides user feedback
 */
export function usePDFGeneration() {
  const [status, setStatus] = useState({
    isGenerating: false,
    stage: null, // 'preparing', 'generating', 'downloading', 'complete', 'error'
    progress: 0,
    error: null,
    usedV2: false,
    fallbackUsed: false
  });

  const generatePDF = useCallback(async (data, options = {}) => {
    setStatus({
      isGenerating: true,
      stage: 'preparing',
      progress: 10,
      error: null,
      usedV2: false,
      fallbackUsed: false
    });

    try {
      // Simulate preparation time for better UX
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setStatus(prev => ({
        ...prev,
        stage: 'generating',
        progress: 30
      }));

      const pdf = await generatePDFReport(data, options);
      
      // Check if we got a v2 Blob or v1 jsPDF object
      const usedV2 = pdf instanceof Blob;
      
      setStatus(prev => ({
        ...prev,
        stage: 'downloading',
        progress: 90,
        usedV2
      }));

      // Generate filename
      const timestamp = new Date().toISOString().split('T')[0];
      const scope = options.scope || 'all';
      const filename = `lightship_${scope}_report_${timestamp}.pdf`;
      
      // Download the PDF
      downloadPDF(pdf, filename);
      
      setStatus(prev => ({
        ...prev,
        stage: 'complete',
        progress: 100
      }));

      // Reset status after delay
      setTimeout(() => {
        setStatus({
          isGenerating: false,
          stage: null,
          progress: 0,
          error: null,
          usedV2: false,
          fallbackUsed: false
        });
      }, 2000);

      return { success: true, usedV2, filename };

    } catch (error) {
      console.error('PDF generation failed:', error);
      
      // Check if this was a v2 failure that fell back to v1
      const fallbackUsed = error.message && error.message.includes('PDF v2 failed');
      
      setStatus({
        isGenerating: false,
        stage: 'error',
        progress: 0,
        error: error.message || 'PDF generation failed',
        usedV2: false,
        fallbackUsed
      });

      // Clear error after delay
      setTimeout(() => {
        setStatus({
          isGenerating: false,
          stage: null,
          progress: 0,
          error: null,
          usedV2: false,
          fallbackUsed: false
        });
      }, 5000);

      return { success: false, error: error.message };
    }
  }, []);

  return { status, generatePDF };
}

/**
 * PDF Generation Status Component
 * Displays current status of PDF generation
 */
export function PDFGenerationStatus({ status }) {
  if (!status.isGenerating && !status.error) {
    return null;
  }

  return (
    <div className="pdf-status-overlay">
      <div className="pdf-status-modal">
        {status.isGenerating && (
          <PDFProgress 
            stage={status.stage}
            progress={status.progress}
            usedV2={status.usedV2}
          />
        )}
        
        {status.error && (
          <PDFError 
            error={status.error}
            fallbackUsed={status.fallbackUsed}
          />
        )}
      </div>
    </div>
  );
}

/**
 * PDF Progress Component
 */
function PDFProgress({ stage, progress, usedV2 }) {
  const getStageMessage = () => {
    switch (stage) {
      case 'preparing': return 'Preparing fund data...';
      case 'generating': return usedV2 ? 'Generating professional PDF...' : 'Generating PDF...';
      case 'downloading': return 'Downloading PDF...';
      case 'complete': return 'PDF generated successfully!';
      default: return 'Processing...';
    }
  };

  const getStageIcon = () => {
    switch (stage) {
      case 'complete': return <CheckCircle className="status-icon success" />;
      default: return <Loader className="status-icon spinning" />;
    }
  };

  return (
    <div className="pdf-progress">
      {getStageIcon()}
      <div className="progress-content">
        <h3>Generating PDF Report</h3>
        <p>{getStageMessage()}</p>
        {usedV2 && stage === 'generating' && (
          <p className="version-info">Using enhanced server-side rendering</p>
        )}
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="progress-text">{progress}%</div>
      </div>
    </div>
  );
}

/**
 * PDF Error Component
 */
function PDFError({ error, fallbackUsed }) {
  return (
    <div className="pdf-error">
      <AlertCircle className="status-icon error" />
      <div className="error-content">
        <h3>
          {fallbackUsed ? 'PDF Generated with Fallback' : 'PDF Generation Failed'}
        </h3>
        
        {fallbackUsed ? (
          <div>
            <p>The enhanced PDF system encountered an issue, but we successfully generated your report using the legacy system.</p>
            <p className="error-details">
              <strong>Note:</strong> Your PDF was created but may have basic formatting instead of the enhanced layout.
            </p>
          </div>
        ) : (
          <div>
            <p>We encountered an error while generating your PDF report.</p>
            <p className="error-details"><strong>Error:</strong> {error}</p>
          </div>
        )}
        
        <div className="error-actions">
          {fallbackUsed ? (
            <div className="success-note">
              <CheckCircle size={16} />
              <span>Report downloaded successfully</span>
            </div>
          ) : (
            <div className="retry-info">
              <p>Please try again or contact support if the issue persists.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Enhanced PDF Button Component
 * Button with integrated status handling
 */
export function PDFButton({ 
  data, 
  options = {}, 
  children = 'Export PDF',
  className = '',
  disabled = false 
}) {
  const { status, generatePDF } = usePDFGeneration();

  const handleClick = async () => {
    if (status.isGenerating || disabled) return;
    
    await generatePDF(data, options);
  };

  return (
    <>
      <button 
        className={`pdf-button ${className} ${status.isGenerating ? 'generating' : ''}`}
        onClick={handleClick}
        disabled={disabled || status.isGenerating}
      >
        {status.isGenerating ? (
          <>
            <Loader className="btn-icon spinning" />
            Generating...
          </>
        ) : (
          <>
            <FileText className="btn-icon" />
            {children}
          </>
        )}
      </button>
      
      <PDFGenerationStatus status={status} />
      
      <style jsx>{`
        .pdf-status-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }
        
        .pdf-status-modal {
          background: white;
          border-radius: 8px;
          padding: 24px;
          min-width: 400px;
          max-width: 500px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
        }
        
        .pdf-progress,
        .pdf-error {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        
        .status-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
        }
        
        .status-icon.success {
          color: #10B981;
        }
        
        .status-icon.error {
          color: #EF4444;
        }
        
        .status-icon.spinning {
          animation: spin 1s linear infinite;
          color: #3B82F6;
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .progress-content,
        .error-content {
          flex: 1;
        }
        
        .progress-content h3,
        .error-content h3 {
          margin: 0 0 8px 0;
          font-size: 18px;
          font-weight: 600;
          color: #1F2937;
        }
        
        .progress-content p,
        .error-content p {
          margin: 0 0 12px 0;
          color: #6B7280;
          line-height: 1.4;
        }
        
        .version-info {
          font-size: 14px !important;
          color: #3B82F6 !important;
          font-weight: 500;
        }
        
        .progress-bar {
          background: #F3F4F6;
          border-radius: 4px;
          height: 8px;
          margin: 12px 0 8px 0;
          overflow: hidden;
        }
        
        .progress-fill {
          background: linear-gradient(90deg, #3B82F6, #10B981);
          height: 100%;
          transition: width 0.3s ease;
          border-radius: 4px;
        }
        
        .progress-text {
          font-size: 14px;
          font-weight: 500;
          color: #374151;
          text-align: center;
        }
        
        .error-details {
          background: #FEF2F2;
          border: 1px solid #FECACA;
          border-radius: 4px;
          padding: 12px;
          font-size: 14px !important;
          color: #991B1B !important;
        }
        
        .error-actions {
          margin-top: 16px;
        }
        
        .success-note {
          display: flex;
          align-items: center;
          gap: 8px;
          color: #10B981;
          font-weight: 500;
        }
        
        .retry-info {
          color: #6B7280;
          font-size: 14px;
        }
        
        .pdf-button {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: #3B82F6;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s ease;
        }
        
        .pdf-button:hover:not(:disabled) {
          background: #2563EB;
        }
        
        .pdf-button:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        
        .pdf-button.generating {
          background: #6B7280;
        }
        
        .btn-icon {
          width: 16px;
          height: 16px;
        }
      `}</style>
    </>
  );
}