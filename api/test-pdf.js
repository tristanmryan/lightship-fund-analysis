/**
 * Simple test endpoint to verify serverless PDF generation works
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
    console.log('🧪 Testing PDF generation...');

    // Test simple HTML to PDF
    const puppeteer = require('puppeteer-core');
    const chromium = require('@sparticuz/chromium');

    console.log('🚀 Launching Chromium...');
    
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: true
    });

    const page = await browser.newPage();
    
    // Simple test HTML
    const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>PDF Test</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 20px; }
    h1 { color: #002F6C; }
  </style>
</head>
<body>
  <h1>Raymond James PDF Test</h1>
  <p>This is a test PDF generated on ${new Date().toLocaleString()}</p>
  <p>If you can see this, the serverless PDF generation is working!</p>
</body>
</html>`;

    await page.setContent(testHtml, { waitUntil: 'networkidle0' });
    
    console.log('📄 Generating PDF...');
    
    const pdfBuffer = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: {
        top: '16mm',
        right: '14mm', 
        bottom: '16mm',
        left: '14mm'
      }
    });

    await browser.close();
    
    console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="test.pdf"');
    res.setHeader('Content-Length', pdfBuffer.length);
    
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ PDF test failed:', error);
    
    return res.status(500).json({
      error: 'PDF test failed',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};