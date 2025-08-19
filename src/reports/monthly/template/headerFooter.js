/**
 * Header and Footer Templates for Puppeteer PDF Generation
 * Provides branded headers and footers with page numbers and disclaimers
 */

/**
 * Get header and footer templates for PDF generation
 * @param {Object} data - Report data
 * @param {Object} options - Report options
 * @returns {Object} Header and footer template strings
 */
function getHeaderFooterTemplates(data, options = {}) {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  return {
    headerTemplate: getHeaderTemplate(data, generatedDate),
    footerTemplate: getFooterTemplate(data, generatedDate)
  };
}

/**
 * Generate header template HTML
 */
function getHeaderTemplate(data, generatedDate) {
  return `
<div style="
  width: 100%;
  font-size: 9pt;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #6B7280;
  padding: 0 14mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 0.5pt solid #E5E7EB;
  padding-bottom: 4pt;
  margin-bottom: 8pt;
">
  <div style="font-weight: 500; color: #002F6C;">
    Raymond James | Monthly Fund Analysis
  </div>
  <div style="font-size: 8pt; color: #9CA3AF;">
    As of ${formatReportDate(data.asOf)}
  </div>
</div>`;
}

/**
 * Generate footer template HTML
 */
function getFooterTemplate(data, generatedDate) {
  return `
<div style="
  width: 100%;
  font-size: 8pt;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #9CA3AF;
  padding: 0 14mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-top: 0.5pt solid #E5E7EB;
  padding-top: 4pt;
  margin-top: 8pt;
">
  <div style="display: flex; flex-direction: column; line-height: 1.3;">
    <div style="font-weight: 500; color: #6B7280;">
      Raymond James & Associates | Confidential
    </div>
    <div style="font-size: 7pt; margin-top: 2pt;">
      Member FINRA/SIPC
    </div>
  </div>
  
  <div style="text-align: center;">
    <div style="font-weight: 500; color: #374151;">
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>
  </div>
  
  <div style="text-align: right; display: flex; flex-direction: column; line-height: 1.3;">
    <div>
      Generated: ${generatedDate}
    </div>
    <div style="font-size: 7pt; margin-top: 2pt;">
      For authorized use only
    </div>
  </div>
</div>`;
}

/**
 * Generate simple header template (for cover page)
 */
function getSimpleHeaderTemplate() {
  return `
<div style="
  width: 100%;
  height: 16mm;
  background: linear-gradient(90deg, #002F6C 0%, #FFC200 100%);
  margin: 0;
  padding: 0;
">
</div>`;
}

/**
 * Generate simple footer template (for cover page) 
 */
function getSimpleFooterTemplate() {
  return `
<div style="
  width: 100%;
  font-size: 7pt;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #9CA3AF;
  text-align: center;
  padding: 8pt 0;
">
  © ${new Date().getFullYear()} Raymond James & Associates, Inc. All rights reserved.
</div>`;
}

/**
 * Generate disclaimer footer for last page
 */
export function getDisclaimerFooterTemplate() {
  return `
<div style="
  width: 100%;
  font-size: 7pt;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #6B7280;
  padding: 8pt 14mm;
  border-top: 1pt solid #E5E7EB;
  background: #F9FAFB;
  line-height: 1.4;
">
  <div style="text-align: center; margin-bottom: 6pt; font-weight: 600; color: #374151;">
    Important Disclosures
  </div>
  
  <div style="display: flex; justify-content: space-between; gap: 16pt;">
    <div style="flex: 1;">
      <strong>Performance:</strong> Past performance does not guarantee future results. 
      Returns may vary and principal value will fluctuate.
    </div>
    
    <div style="flex: 1;">
      <strong>Risk:</strong> All investments involve risk including potential loss of principal. 
      Consult your advisor before investing.
    </div>
    
    <div style="flex: 1;">
      <strong>Data:</strong> Information sourced from fund companies and third parties. 
      Accuracy not guaranteed. For informational purposes only.
    </div>
  </div>
  
  <div style="text-align: center; margin-top: 8pt; padding-top: 6pt; border-top: 0.5pt solid #D1D5DB;">
    Raymond James & Associates, Inc. Member FINRA/SIPC | 
    Page <span class="pageNumber"></span> of <span class="totalPages"></span>
  </div>
</div>`;
}

/**
 * Get page-specific templates based on page type
 */
function getPageSpecificTemplates(pageType, data, options = {}) {
  const generatedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric', 
    year: 'numeric'
  });

  switch (pageType) {
    case 'cover':
      return {
        headerTemplate: getSimpleHeaderTemplate(),
        footerTemplate: getSimpleFooterTemplate()
      };
      
    case 'disclaimer':
      return {
        headerTemplate: getHeaderTemplate(data, generatedDate),
        footerTemplate: getDisclaimerFooterTemplate()
      };
      
    case 'content':
    default:
      return {
        headerTemplate: getHeaderTemplate(data, generatedDate),
        footerTemplate: getFooterTemplate(data, generatedDate)
      };
  }
}

/**
 * Generate custom header with logo (if logo data is available)
 */
function getLogoHeaderTemplate(logoDataUri, data) {
  return `
<div style="
  width: 100%;
  font-size: 9pt;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #6B7280;
  padding: 0 14mm;
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 0.5pt solid #E5E7EB;
  padding-bottom: 6pt;
  margin-bottom: 8pt;
">
  <div style="display: flex; align-items: center; gap: 12pt;">
    ${logoDataUri ? `<img src="${logoDataUri}" style="height: 20pt; width: auto;" alt="Raymond James Logo" />` : ''}
    <div style="font-weight: 500; color: #002F6C;">
      Monthly Fund Analysis
    </div>
  </div>
  
  <div style="text-align: right; font-size: 8pt; color: #9CA3AF;">
    <div>As of ${formatReportDate(data.asOf)}</div>
    <div style="margin-top: 2pt; font-size: 7pt;">
      ${data.totalFunds} funds • ${data.recommendedFunds} recommended
    </div>
  </div>
</div>`;
}

/**
 * Generate watermark template for draft reports
 */
function getWatermarkTemplate(text = 'DRAFT') {
  return `
<div style="
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  font-size: 72pt;
  font-weight: bold;
  color: rgba(0, 47, 108, 0.1);
  font-family: Arial, sans-serif;
  z-index: -1;
  pointer-events: none;
  user-select: none;
">
  ${text}
</div>`;
}

// Utility Functions

/**
 * Format report date for display
 */
function formatReportDate(dateStr) {
  if (!dateStr) return 'N/A';
  
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

/**
 * Generate responsive header that adapts to content width
 */
function getResponsiveHeaderTemplate(data, options = {}) {
  const { showLogo = false, showMetadata = true, compact = false } = options;
  
  if (compact) {
    return `
<div style="
  width: 100%;
  font-size: 8pt;
  font-family: 'Segoe UI', Arial, sans-serif;
  color: #002F6C;
  padding: 0 14mm;
  text-align: center;
  border-bottom: 0.5pt solid #E5E7EB;
  padding-bottom: 3pt;
  margin-bottom: 6pt;
  font-weight: 600;
">
  Raymond James | Monthly Fund Analysis${showMetadata ? ` | ${formatReportDate(data.asOf)}` : ''}
</div>`;
  }
  
  return getHeaderTemplate(data, new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }));
}

// Export for CommonJS
module.exports = {
  getHeaderFooterTemplates,
  getSimpleHeaderTemplate,
  getSimpleFooterTemplate,
  getPageSpecificTemplates,
  getLogoHeaderTemplate,
  getWatermarkTemplate,
  getResponsiveHeaderTemplate
};