# PDF Report System v2 Documentation

## Overview

The PDF Report System v2 provides professional, server-rendered HTML-to-PDF reports with enhanced branding, layout, and reliability compared to the legacy client-side PDF generation.

## Architecture

### Core Components

```
src/reports/monthly/
├── data/
│   └── shapeData.js          # Data fetching and normalization
├── template/
│   ├── MonthlyReport.jsx     # React HTML template
│   ├── styles.js             # Print-optimized CSS
│   └── headerFooter.js       # Header/footer templates
├── theme/
│   └── tokens.js             # Design tokens and branding
├── shared/
│   └── format.js             # Shared formatting functions
└── fonts/                    # Brand fonts (future)

api/reports/
└── monthly.js                # Vercel serverless function

components/
└── PDFGenerationStatus.jsx   # User feedback component
```

### Data Flow

1. **Client Request** → `generatePDFReport()` with feature flag check
2. **API Call** → `/api/reports/monthly` with fund selection payload
3. **Data Shaping** → Fetch funds, resolve benchmarks, group by asset class
4. **Template Rendering** → React SSR to HTML with embedded styles
5. **PDF Generation** → Puppeteer + Chromium → PDF buffer
6. **Download** → Return PDF blob to client

## Feature Flag Configuration

### Environment Variables

```bash
# Enable PDF v2 (default: false)
REACT_APP_ENABLE_PDF_V2=true
```

### Runtime Control

```javascript
// Force v2 for specific request
const pdf = await generatePDFReport(data, { forceV2: true });

// Check which version was used
if (pdf instanceof Blob) {
  console.log('PDF v2 was used');
} else {
  console.log('Legacy PDF was used');
}
```

## API Reference

### `/api/reports/monthly`

**Method:** POST

**Payload:**
```json
{
  "asOf": "2025-03-31",
  "selection": {
    "scope": "all | recommended | tickers",
    "tickers": ["AAPL", "MSFT"]  // required when scope = "tickers"
  },
  "options": {
    "columns": ["ticker", "name", "ytd_return", ...],
    "brand": "RJ",
    "locale": "en-US", 
    "landscape": true,
    "includeTOC": true
  }
}
```

**Response:** PDF binary data with appropriate headers

**Error Response:**
```json
{
  "error": "PDF generation failed",
  "message": "Detailed error message",
  "details": "Stack trace (development only)"
}
```

## Client Integration

### Basic Usage

```javascript
import { generatePDFReport, downloadPDF } from '../services/exportService';

// Generate and download PDF
const handleExportPDF = async () => {
  try {
    const pdf = await generatePDFReport({ funds, metadata });
    downloadPDF(pdf, 'monthly_report.pdf');
  } catch (error) {
    console.error('PDF export failed:', error);
  }
};
```

### Enhanced Component with Status

```javascript
import { PDFButton } from '../components/PDFGenerationStatus';

// Button with built-in progress and error handling
<PDFButton
  data={{ funds, metadata }}
  options={{ scope: 'recommended' }}
  className="custom-pdf-btn"
>
  Export Recommended Funds
</PDFButton>
```

### Custom Status Handling

```javascript
import { usePDFGeneration } from '../components/PDFGenerationStatus';

const { status, generatePDF } = usePDFGeneration();

const handleGenerate = async () => {
  const result = await generatePDF(data, options);
  if (result.success) {
    console.log(`PDF generated using ${result.usedV2 ? 'v2' : 'v1'}`);
  }
};
```

## Customization

### Styling

The PDF styles are generated in `src/reports/monthly/template/styles.js`:

```javascript
// Modify theme tokens
const theme = getReportTheme();
theme.colors.brand.primary = '#custom-color';

// Generate custom CSS
const css = getReportCSS(theme);
```

### Template Content

Modify the React template in `src/reports/monthly/template/MonthlyReport.jsx`:

```javascript
// Add custom sections
export function MonthlyReport({ data, options, theme }) {
  return (
    <div className="monthly-report">
      <CoverPage />
      <ExecutiveSummary />
      <CustomSection />  {/* Add your section */}
      {data.sections.map(section => (
        <AssetClassSection key={section.assetClass} section={section} />
      ))}
    </div>
  );
}
```

### Data Processing

Extend the data shaping in `src/reports/monthly/data/shapeData.js`:

```javascript
// Add custom metrics or calculations
export async function shapeReportData(payload) {
  const sections = await buildAssetClassSections(funds, asOf);
  
  // Add custom calculations
  sections.forEach(section => {
    section.customMetric = calculateCustomMetric(section.rows);
  });
  
  return { sections, /* other data */ };
}
```

## Deployment

### Vercel Configuration

The system is automatically deployed with your Vercel app. The `vercel.json` includes:

```json
{
  "functions": {
    "api/reports/monthly.js": {
      "memory": 1024,
      "maxDuration": 60,
      "includeFiles": "src/reports/fonts/**"
    }
  }
}
```

### Performance Considerations

- **Memory:** 1024MB allocated for Chromium rendering
- **Duration:** 60s timeout for large reports
- **Cold Starts:** ~1-2s initial delay for first request per region
- **Fonts:** Embedded as data URLs to avoid external dependencies

## Testing

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm start

# Test PDF generation (requires local Vercel CLI)
vercel dev
```

### Manual Testing

1. Set `REACT_APP_ENABLE_PDF_V2=true` in `.env.local`
2. Navigate to Dashboard or Reports
3. Click "Export PDF" button
4. Verify:
   - Console shows "Using PDF v2"
   - Professional layout and branding
   - Benchmark rows appear at bottom of each asset class
   - Headers/footers on each page
   - File downloads as `.pdf`

### Integration Testing

```javascript
// Test API endpoint directly
const response = await fetch('/api/reports/monthly', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    selection: { scope: 'all' },
    options: { landscape: true }
  })
});

const blob = await response.blob();
console.log(`PDF size: ${blob.size} bytes`);
```

## Troubleshooting

### Common Issues

**1. API Returns 500 Error**
```
Check Vercel function logs:
- Puppeteer/Chromium initialization
- React rendering errors
- Data fetching failures
```

**2. PDF Generation Timeout**
```
- Reduce dataset size
- Check for infinite loops in React components
- Verify database queries are efficient
```

**3. Fonts Not Displaying**
```
- Ensure fonts are properly embedded in CSS
- Check font file paths in vercel.json
- Verify font fallbacks are working
```

**4. Missing Benchmark Data**
```
- Check Supabase table permissions
- Verify benchmark mapping configuration
- Review console logs for resolver errors
```

### Fallback Behavior

The system automatically falls back to legacy PDF generation when:

- Feature flag is disabled (`REACT_APP_ENABLE_PDF_V2=false`)
- API request fails (network, server error)
- PDF v2 throws an exception

Users will see appropriate feedback:
- "Using enhanced server-side rendering" for v2
- "PDF Generated with Fallback" if v2 failed but v1 succeeded
- Clear error messages for complete failures

### Debug Mode

Enable verbose logging:

```javascript
// In browser console
localStorage.setItem('pdf-debug', 'true');

// Check logs
console.log('PDF generation logs:', getPDFLogs());
```

## Performance Metrics

Expected performance (varies by data size):

| Fund Count | Generation Time | PDF Size | Memory Usage |
|------------|----------------|----------|--------------|
| 50         | 2-3s          | 200-300KB | 400MB       |
| 100        | 3-5s          | 400-600KB | 500MB       |
| 200        | 5-8s          | 800KB-1MB | 600MB       |
| 500+       | 10-15s        | 2-3MB     | 800MB       |

## Migration from v1

To fully migrate to PDF v2:

1. Set `REACT_APP_ENABLE_PDF_V2=true` in production
2. Monitor error rates and user feedback
3. Gradually remove v1 code after stable deployment
4. Update documentation and training materials

## Security Considerations

- PDF contains confidential fund data
- API endpoint requires proper authorization
- Generated PDFs include appropriate disclaimers
- No external font or asset dependencies
- Server-side rendering prevents client-side data exposure

## Support

For issues or questions:

1. Check console logs and network tab
2. Review Vercel function logs
3. Test with feature flag disabled (fallback to v1)
4. Contact development team with reproduction steps