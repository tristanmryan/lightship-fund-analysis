/**
 * Vercel Serverless Function for Professional Monthly PDF Reports
 * Uses React-PDF for high-performance PDF generation without Chromium
 */

// Payload validation schema will be defined after dynamic imports

export default async function handler(req, res) {
  // CORS headers (permissive for simplified system)
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
    // Dynamic imports
    const { z } = await import('zod');
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const React = (await import('react')).default;

    const { shapeReportData } = await import('../../src/reports/monthly/data/shapeData.js');
    const MonthlyReportPDF = (await import('../../src/reports/monthly/template/MonthlyReportPDF.js')).default;

    // Payload validation schema
    const PayloadSchema = z.object({
      asOf: z.string().nullable().optional(),
      selection: z.object({
        scope: z.enum(['all', 'recommended', 'tickers']),
        tickers: z.array(z.string()).nullable().optional(),
      }),
      options: z
        .object({
          columns: z.array(z.string()).optional(),
          brand: z.string().default('RJ'),
          locale: z.string().default('en-US'),
          landscape: z.boolean().default(true),
          includeTOC: z.boolean().default(true),
        })
        .optional(),
    });

    // Parse request
    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payload = PayloadSchema.parse(raw);
    const scope = payload.selection?.scope;
    const asOf = payload.asOf || 'latest';
    console.log('[MonthlyPDF] Generating', { scope, asOf });

    // Shape data and render
    const shapedData = await shapeReportData(payload);
    const reportComponent = React.createElement(MonthlyReportPDF, {
      data: shapedData,
      options: payload.options || {},
    });
    const pdfBuffer = await renderToBuffer(reportComponent);
    console.log('[MonthlyPDF] Done', { bytes: pdfBuffer.length });

    // Return PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="lightship_monthly_report_${shapedData.asOf.replace(/-/g, '')}.pdf"`
    );
    res.setHeader('Content-Length', pdfBuffer.length);
    return res.send(pdfBuffer);
  } catch (error) {
    console.error('[MonthlyPDF] Generation failed:', error?.message || error);
    // Determine error type for better messaging
    let errorType = 'Unknown error';
    if (error?.message?.includes('Data shaping')) {
      errorType = 'Data processing error';
    } else if (error?.message?.includes('React-PDF') || error?.message?.includes('template')) {
      errorType = 'PDF rendering error';
    } else if (error?.message?.includes('validation')) {
      errorType = 'Request validation error';
    }

    return res.status(500).json({
      error: 'React-PDF generation failed',
      type: errorType,
      message: error?.message || String(error),
      details: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}
