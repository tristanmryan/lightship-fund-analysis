/**
 * Advanced Test Endpoint for PDF Generation
 * Tests the complete PDF pipeline with real data
 */

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🧪 Advanced PDF test starting...');

    // Test 1: Basic dependencies
    console.log('📦 Testing basic dependencies...');
    const puppeteer = require('puppeteer-core');
    const chromium = require('@sparticuz/chromium');
    console.log('✅ Puppeteer and Chromium loaded');

    // Test 2: React dependencies
    console.log('⚛️ Testing React dependencies...');
    const { renderToStaticMarkup } = require('react-dom/server');
    const React = require('react');
    console.log('✅ React dependencies loaded');

    // Test 3: Browser launch
    console.log('🚀 Testing browser launch...');
    const browser = await (puppeteer.launch || puppeteer.default?.launch)({
      args: chromium.args || chromium.default?.args || [],
      defaultViewport: chromium.defaultViewport || chromium.default?.defaultViewport,
      executablePath: await (chromium.executablePath ? chromium.executablePath() : chromium.default?.executablePath?.()),
      headless: true,
      ignoreHTTPSErrors: true
    });
    console.log('✅ Browser launched successfully');

    // Test 4: Simple PDF generation
    console.log('📄 Testing PDF generation...');
    const page = await browser.newPage();
    
    const testHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>PDF Test</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .header { color: #002F6C; font-size: 24px; font-weight: bold; }
        .content { margin: 20px 0; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #4472C4; color: white; }
        .benchmark { background-color: #FFF3CD; font-weight: bold; }
      </style>
    </head>
    <body>
      <div class="header">Raymond James PDF Test - Advanced</div>
      <div class="content">
        <p>This is an advanced test of the PDF generation system.</p>
        <p>Testing date: ${new Date().toLocaleDateString()}</p>
        
        <table>
          <thead>
            <tr>
              <th>Fund Name</th>
              <th>Ticker</th>
              <th>Asset Class</th>
              <th>YTD Return</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Test Fund A</td>
              <td>TESTA</td>
              <td>Large Cap Growth</td>
              <td>12.5%</td>
            </tr>
            <tr>
              <td>Test Fund B</td>
              <td>TESTB</td>
              <td>Large Cap Growth</td>
              <td>8.3%</td>
            </tr>
            <tr class="benchmark">
              <td>BENCHMARK: Russell 1000 Growth</td>
              <td>IWF</td>
              <td>Large Cap Growth</td>
              <td>10.2%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </body>
    </html>`;

    await page.setContent(testHtml, { waitUntil: 'networkidle0' });
    
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      landscape: true,
      printBackground: true,
      margin: {
        top: '16mm',
        right: '14mm',
        bottom: '16mm',
        left: '14mm'
      }
    });

    await browser.close();
    console.log(`✅ Advanced PDF test completed: ${pdfBuffer.length} bytes`);

    // Return the PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="advanced_pdf_test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ Advanced PDF test failed:', error);
    
    return res.status(500).json({
      error: 'Advanced PDF test failed',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  }
};