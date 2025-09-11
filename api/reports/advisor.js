/**
 * Serverless API: Advisor Portfolio PDF (React-PDF)
 */

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { z } = await import('zod');
    const { renderToBuffer } = await import('@react-pdf/renderer');
    const React = (await import('react')).default;
    const AdvisorPortfolioPDF = (await import('../../src/reports/advisor/AdvisorPortfolioPDF.js')).default;

    const PayloadSchema = z.object({
      snapshotDate: z.string().nullable().optional(),
      advisorId: z.string().nullable().optional(),
      summary: z
        .object({ client_count: z.number().nullable().optional() })
        .nullable()
        .optional(),
      portfolio: z
        .object({
          totalAum: z.number().nullable().optional(),
          recommendedAum: z.number().nullable().optional(),
          uniqueHoldings: z.number().nullable().optional(),
          allocation: z
            .array(
              z.object({ asset_class: z.string().nullable().optional(), amount: z.number().nullable().optional(), pct: z.number().nullable().optional() })
            )
            .nullable()
            .optional(),
          positions: z
            .array(
              z.object({ ticker: z.string().nullable().optional(), amount: z.number().nullable().optional(), pct: z.number().nullable().optional(), is_recommended: z.boolean().nullable().optional() })
            )
            .nullable()
            .optional(),
        })
        .nullable()
        .optional(),
    });

    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payload = PayloadSchema.parse(raw);
    const component = React.createElement(AdvisorPortfolioPDF, { data: payload });
    const buffer = await renderToBuffer(component);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="advisor_portfolio_${(payload.snapshotDate || '').replace(/-/g, '') || 'latest'}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error('[AdvisorPDF] Generation failed:', error?.message || error);
    return res.status(500).json({ error: 'Advisor PDF generation failed', message: error?.message || String(error) });
  }
}
