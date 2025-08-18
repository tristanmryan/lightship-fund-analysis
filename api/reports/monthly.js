/**
 * Vercel Serverless Function for Professional Monthly PDF Reports
 * Uses React-PDF for high-performance PDF generation without Chromium
 */

// Payload validation schema will be defined after dynamic imports

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
    console.log('🚀 Starting React-PDF generation process...');
    
    // Import all dependencies using dynamic import for ES module compatibility
    console.log('📦 Importing dependencies...');
    let z, renderToBuffer, React, shapeReportData, MonthlyReportPDF;
    
    try {
      const zodModule = await import('zod');
      z = zodModule.z;
      console.log('✅ Zod validation library loaded');
      
      // Define payload validation schema after Zod is loaded
      const PayloadSchema = z.object({
        asOf: z.string().nullable().optional(),
        selection: z.object({
          scope: z.enum(['all', 'recommended', 'tickers']),
          tickers: z.array(z.string()).nullable().optional()
        }),
        options: z.object({
          columns: z.array(z.string()).optional(),
          brand: z.string().default('RJ'),
          locale: z.string().default('en-US'),
          landscape: z.boolean().default(true),
          includeTOC: z.boolean().default(true)
        }).optional()
      });
      
    } catch (e) {
      console.error('❌ Failed to load Zod:', e.message);
      throw new Error('Zod validation library unavailable');
    }
    
    try {
      const reactPdfModule = await import('@react-pdf/renderer');
      renderToBuffer = reactPdfModule.renderToBuffer;
      console.log('✅ React-PDF renderer loaded');
    } catch (e) {
      console.error('❌ Failed to load React-PDF renderer:', e.message);
      throw new Error('React-PDF renderer unavailable');
    }
    
    try {
      const reactModule = await import('react');
      React = reactModule.default;
      console.log('✅ React module loaded');
    } catch (e) {
      console.error('❌ Failed to load React module:', e.message);
      throw new Error('React module unavailable');
    }
    
    // Import our services and components
    console.log('🎨 Importing report services...');
    
    try {
      const shapeDataModule = await import('../../src/reports/monthly/data/shapeData.js');
      shapeReportData = shapeDataModule.shapeReportData;
      console.log('✅ Data shaping service loaded');
    } catch (e) {
      console.error('❌ Failed to load shapeReportData:', e.message);
      throw new Error('Data shaping service unavailable');
    }
    
    try {
      MonthlyReportPDF = require('../../src/reports/monthly/template/MonthlyReportPDF.js');
      console.log('✅ React-PDF Monthly report template loaded');
    } catch (e) {
      console.error('❌ Failed to load MonthlyReportPDF:', e.message);
      throw new Error('React-PDF template unavailable');
    }
    
    // Now validate payload after all dependencies are loaded
    console.log('🔍 Validating request payload...');
    const payload = PayloadSchema.parse(req.body);
    console.log('✅ Payload validated:', { scope: payload.selection?.scope, asOf: payload.asOf });
    
    console.log(`📊 Processing PDF request: ${payload.selection.scope}, asOf: ${payload.asOf || 'latest'}`);

    // Step 1: Shape the data
    console.log('📋 Shaping report data...');
    const shapedData = await shapeReportData(payload);
    console.log(`✅ Data shaped successfully: ${shapedData.sections.length} asset class sections`);

    // Step 2: Create React-PDF component
    console.log('⚛️ Creating React-PDF component...');
    const reportComponent = React.createElement(MonthlyReportPDF, {
      data: shapedData,
      options: payload.options || {}
    });
    console.log('✅ React-PDF component created');
    
    // Step 3: Render to PDF buffer
    console.log('🖨️ Rendering PDF with React-PDF...');
    const pdfBuffer = await renderToBuffer(reportComponent);
    console.log(`✅ PDF generated successfully: ${pdfBuffer.length} bytes`);

    // Return PDF
    console.log('📤 Sending PDF response...');
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 
      `attachment; filename="lightship_monthly_report_${shapedData.asOf.replace(/-/g, '')}.pdf"`);
    res.setHeader('Content-Length', pdfBuffer.length);
    
    console.log('🎉 React-PDF generation completed successfully!');
    return res.send(pdfBuffer);

  } catch (error) {
    console.error('❌ React-PDF generation failed:', error.message);
    console.error('❌ Full error:', error);
    
    // Determine error type for better messaging
    let errorType = 'Unknown error';
    if (error.message.includes('Data shaping')) {
      errorType = 'Data processing error';
    } else if (error.message.includes('React-PDF') || error.message.includes('template')) {
      errorType = 'PDF rendering error';
    } else if (error.message.includes('validation')) {
      errorType = 'Request validation error';
    }
    
    // Return structured error
    return res.status(500).json({
      error: 'React-PDF generation failed',
      type: errorType,
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
  }
}

