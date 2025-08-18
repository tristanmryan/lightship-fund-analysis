/**
 * Vercel Serverless Function for Professional Monthly PDF Reports
 * Uses Puppeteer + React SSR for pixel-perfect PDF generation
 */

const { z } = require('zod');

// Payload validation schema
const PayloadSchema = z.object({
  asOf: z.string().optional(),
  selection: z.object({
    scope: z.enum(['all', 'recommended', 'tickers']),
    tickers: z.array(z.string()).optional()
  }),
  options: z.object({
    columns: z.array(z.string()).optional(),
    brand: z.string().default('RJ'),
    locale: z.string().default('en-US'),
    landscape: z.boolean().default(true),
    includeTOC: z.boolean().default(true)
  }).optional()
});

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Validate payload
    const payload = PayloadSchema.parse(req.body);
    
    // Import dependencies
    const puppeteer = require('puppeteer-core');
    const chromium = require('@sparticuz/chromium');
    const { renderToStaticMarkup } = require('react-dom/server');
    const React = require('react');
    
    // Import our services
    const { shapeReportData } = require('../../src/reports/monthly/data/shapeData.js');
    const { MonthlyReport } = require('../../src/reports/monthly/template/MonthlyReport.jsx');
    const { getReportTheme } = require('../../src/reports/monthly/theme/tokens.js');
    const { getHeaderFooterTemplates } = require('../../src/reports/monthly/template/headerFooter.js');
    
    console.log(`📊 Processing PDF request: ${payload.selection.scope}, asOf: ${payload.asOf || 'latest'}`);

    // Step 1: Shape the data
    const shapedData = await shapeReportData(payload);
    console.log(`📈 Shaped data: ${shapedData.sections.length} asset class sections`);

    // Step 2: Get theme and templates
    const theme = getReportTheme();
    const { headerTemplate, footerTemplate } = getHeaderFooterTemplates(shapedData, payload.options);

    // Step 3: Render React to HTML
    const reportComponent = React.createElement(MonthlyReport, {
      data: shapedData,
      options: payload.options || {},
      theme
    });
    
    const htmlContent = renderToStaticMarkup(reportComponent);
    
    // Step 4: Build complete HTML document with embedded fonts and styles
    const fullHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Raymond James Monthly Report</title>
  <style>
    ${await getEmbeddedStyles(theme)}
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>`;

    // Step 5: Launch Puppeteer and generate PDF
    console.log('🚀 Launching Chromium for PDF generation...');
    
    const browser = await puppeteer.default.launch({
      args: chromium.default.args,
      defaultViewport: chromium.default.defaultViewport,
      executablePath: await chromium.default.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    
    // Set content and wait for any async operations
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    
    // Generate PDF with professional settings
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: payload.options?.landscape || true,
      printBackground: true,
      margin: {
        top: '16mm',
        right: '14mm', 
        bottom: '16mm',
        left: '14mm'
      },
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate
    });

    await browser.close();
    
    console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      `attachment; filename="lightship_monthly_report_${shapedData.asOf.replace(/-/g, '')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ PDF generation failed:', error);
    
    // Return structured error
    return res.status(500).json({
      error: 'PDF generation failed',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

/**
 * Get embedded CSS styles with fonts
 */
async function getEmbeddedStyles(theme) {
  try {
    // Import the CSS content
    const { getReportCSS } = require('../../src/reports/monthly/template/styles.js');
    return getReportCSS(theme);
  } catch (error) {
    console.warn('⚠️ Could not load custom styles, using fallback');
    return `
      @page { size: Letter landscape; margin: 16mm 14mm; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
      th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
      th { background-color: #f5f5f5; font-weight: bold; }
      .benchmark-row { background-color: #fff3cd; font-weight: bold; }
      h1, h2 { color: #002f6c; }
    `;
  }
}