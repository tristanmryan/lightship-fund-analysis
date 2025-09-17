/**
 * Serverless API: Trade Flows PDF (React-PDF)
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
    const TradeFlowsPDF = (await import('../../src/reports/tradeflows/TradeFlowsPDF.js')).default;

    const RowNum = z.number().nullable().optional();
    const PayloadSchema = z.object({
      month: z.string().nullable().optional(),
      assetClass: z.string().nullable().optional(),
      ticker: z.string().nullable().optional(),
      topInflows: z.array(z.object({
        ticker: z.string().nullable().optional(),
        inflows: RowNum,
        outflows: RowNum,
        net_flow: RowNum,
        delta_net: RowNum,
        advisors_trading: RowNum,
      })).nullable().optional(),
      topOutflows: z.array(z.object({
        ticker: z.string().nullable().optional(),
        inflows: RowNum,
        outflows: RowNum,
        net_flow: RowNum,
        delta_net: RowNum,
        advisors_trading: RowNum,
      })).nullable().optional(),
      heatmap: z.array(z.object({
        asset_class: z.string().nullable().optional(),
        inflows: RowNum,
        outflows: RowNum,
        net_flow: RowNum,
        funds_traded: RowNum,
        advisors_trading: RowNum,
      })).nullable().optional(),
      trend: z.array(z.object({ month: z.string().nullable().optional(), net_flow: RowNum })).nullable().optional(),
      sentiment: z.object({
        advisors_buying: RowNum,
        advisors_selling: RowNum,
        advisors_neutral: RowNum,
        advisors_total: RowNum,
      }).nullable().optional(),
    });

    const raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const payload = PayloadSchema.parse(raw);
    const component = React.createElement(TradeFlowsPDF, { data: payload });
    const buffer = await renderToBuffer(component);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="trade_flows_${(payload.month || '').replace(/-/g, '') || 'latest'}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (error) {
    console.error('[TradeFlowsPDF] Generation failed:', error?.message || error);
    return res.status(500).json({ error: 'Trade Flows PDF generation failed', message: error?.message || String(error) });
  }
}
