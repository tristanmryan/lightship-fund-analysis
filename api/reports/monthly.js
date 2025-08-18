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
    console.log('🚀 Starting PDF generation process...');
    
    // Validate payload
    const payload = PayloadSchema.parse(req.body);
    console.log('✅ Payload validated:', { scope: payload.selection?.scope, asOf: payload.asOf });
    
    // Import dependencies with detailed error logging
    console.log('📦 Importing Puppeteer dependencies...');
    const puppeteer = require('puppeteer-core');
    const chromium = require('@sparticuz/chromium');
    console.log('✅ Puppeteer dependencies loaded');
    
    console.log('⚛️ Importing React dependencies...');
    const { renderToStaticMarkup } = require('react-dom/server');
    const React = require('react');
    console.log('✅ React dependencies loaded');
    
    // Try to import our services with fallbacks
    console.log('🎨 Importing report services...');
    let shapeReportData, MonthlyReport, getReportTheme, getHeaderFooterTemplates;
    
    try {
      ({ shapeReportData } = require('../../src/reports/monthly/data/shapeData.js'));
      console.log('✅ Data shaping service loaded');
    } catch (e) {
      console.error('❌ Failed to load shapeReportData:', e.message);
      throw new Error('Data shaping service unavailable');
    }
    
    try {
      ({ MonthlyReport } = require('../../src/reports/monthly/template/MonthlyReport.jsx'));
      console.log('✅ Monthly report template loaded');
    } catch (e) {
      console.error('❌ Failed to load MonthlyReport:', e.message);
      // Use a simple fallback template
      MonthlyReport = ({ data }) => React.createElement('div', null, 
        React.createElement('h1', null, 'Raymond James Monthly Fund Analysis'),
        React.createElement('p', null, `Report generated for ${data?.totalFunds || 0} funds`)
      );
      console.log('🔄 Using fallback template');
    }
    
    try {
      ({ getReportTheme } = require('../../src/reports/monthly/theme/tokens.js'));
      console.log('✅ Theme configuration loaded');
    } catch (e) {
      console.error('❌ Failed to load theme:', e.message);
      getReportTheme = () => ({ colors: { brand: { primary: '#002F6C' } } });
      console.log('🔄 Using fallback theme');
    }
    
    try {
      ({ getHeaderFooterTemplates } = require('../../src/reports/monthly/template/headerFooter.js'));
      console.log('✅ Header/footer templates loaded');
    } catch (e) {
      console.error('❌ Failed to load header/footer:', e.message);
      getHeaderFooterTemplates = () => ({ headerTemplate: '', footerTemplate: '' });
      console.log('🔄 Using fallback header/footer');
    }
    
    console.log(`📊 Processing PDF request: ${payload.selection.scope}, asOf: ${payload.asOf || 'latest'}`);

    // Step 1: Shape the data
    console.log('📋 Shaping report data...');
    const shapedData = await shapeReportData(payload);
    console.log(`✅ Data shaped successfully: ${shapedData.sections.length} asset class sections`);

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
    
    // Try to get chromium configuration with fallbacks
    let chromiumArgs, chromiumViewport, executablePath;
    
    try {
      chromiumArgs = chromium.args || chromium.default?.args || [];
      chromiumViewport = chromium.defaultViewport || chromium.default?.defaultViewport || { width: 1920, height: 1080 };
      executablePath = await (chromium.executablePath ? chromium.executablePath() : chromium.default?.executablePath?.() || '/usr/bin/chromium-browser');
      console.log('✅ Chromium configuration prepared');
      console.log('📍 Executable path:', executablePath);
    } catch (e) {
      console.error('❌ Failed to configure Chromium:', e.message);
      throw new Error('Chromium configuration failed');
    }
    
    const browser = await (puppeteer.launch || puppeteer.default?.launch)({
      args: chromiumArgs,
      defaultViewport: chromiumViewport,
      executablePath: executablePath,
      headless: true,
      ignoreHTTPSErrors: true
    });
    console.log('✅ Browser launched successfully');

    console.log('📄 Creating new page...');
    const page = await browser.newPage();
    console.log('✅ Page created');
    
    // Set content and wait for any async operations
    console.log('📝 Setting page content...');
    await page.setContent(fullHtml, { waitUntil: 'networkidle0' });
    console.log('✅ Page content set');
    
    // Generate PDF with professional settings
    console.log('🖨️ Generating PDF...');
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
    console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);

    console.log('🔒 Closing browser...');
    await browser.close();
    console.log('✅ Browser closed');

    // Return PDF
    console.log('📤 Sending PDF response...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      `attachment; filename="lightship_monthly_report_${shapedData.asOf.replace(/-/g, '')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    console.log('🎉 PDF generation completed successfully!');
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ PDF generation failed at step:', error.step || 'unknown');
    console.error('❌ Error details:', error.message);
    console.error('❌ Full error:', error);
    
    // Determine error type for better messaging
    let errorType = 'Unknown error';
    if (error.message.includes('Data shaping')) {
      errorType = 'Data processing error';
    } else if (error.message.includes('Chromium') || error.message.includes('Puppeteer')) {
      errorType = 'PDF rendering error';
    } else if (error.message.includes('template') || error.message.includes('React')) {
      errorType = 'Template rendering error';
    }
    
    // Return structured error
    return res.status(500).json({
      error: 'PDF generation failed',
      type: errorType,
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
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