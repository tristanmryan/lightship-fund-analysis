# Weight Management Service Usage Guide

## Overview

The Weight Management Service provides a simple 2-tier weight management system for the clean scoring engine:

1. **Global Default Weights** - Base weights from `scoringService.js`
2. **Asset Class Overrides** - Custom weights stored in database per asset class

## Quick Start

```javascript
import { getWeightsForAssetClass, saveAssetClassWeights } from './src/services/weightService.js';
import { calculateScores } from './src/services/scoringService.js';

// Get weights for an asset class (with automatic fallback to defaults)
const weights = await getWeightsForAssetClass('asset-class-uuid');

// Use with scoring service
const scoredFunds = calculateScores(funds, { 'Large Cap Growth': weights });
```

## Database Setup

Run the SQL schema to create the weights table:

```sql
-- See database/scoring_weights_simple_schema.sql
CREATE TABLE scoring_weights_simple (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_class_id UUID REFERENCES asset_classes(id),
  metric_key TEXT NOT NULL,
  weight NUMERIC NOT NULL,
  -- ... other fields
);
```

## API Reference

### Core Functions

#### `getWeightsForAssetClass(assetClassId)`
- **Purpose**: Get weights for specific asset class with fallback to defaults
- **Returns**: Promise<Object> - Weights object
- **Example**:
```javascript
const weights = await getWeightsForAssetClass('uuid-123');
// { ytd_return: 0.15, one_year_return: 0.25, ... }
```

#### `saveAssetClassWeights(assetClassId, weights)`
- **Purpose**: Save custom weights for an asset class
- **Returns**: Promise<boolean> - Success status
- **Example**:
```javascript
const success = await saveAssetClassWeights('uuid-123', {
  ytd_return: 0.30,
  one_year_return: 0.40,
  sharpe_ratio: 0.30
});
```

#### `resetAssetClassWeights(assetClassId)`
- **Purpose**: Remove custom weights (revert to defaults)
- **Returns**: Promise<boolean> - Success status

### Utility Functions

#### `getGlobalDefaultWeights()`
- Returns copy of global default weights from scoring service

#### `validateWeights(weights)`
- Validates weight object structure and values
- Returns validation result with errors/warnings

#### `getWeightsDifferenceSummary(weights)`
- Shows differences between provided weights and defaults
- Useful for admin interface display

## Integration with Scoring Service

The weight service integrates seamlessly with the scoring service:

```javascript
// Method 1: Load weights dynamically per asset class
const assetClasses = [...new Set(funds.map(f => f.asset_class_name))];
const weightsByAssetClass = {};

for (const assetClass of assetClasses) {
  const assetClassId = await getAssetClassId(assetClass); // Your lookup function
  weightsByAssetClass[assetClass] = await getWeightsForAssetClass(assetClassId);
}

const scoredFunds = calculateScores(funds, weightsByAssetClass);

// Method 2: Bulk loading for performance
const assetClassIds = await getAssetClassIds(funds);
const bulkWeights = await getBulkWeightsForAssetClasses(assetClassIds);
const scoredFunds = calculateScores(funds, bulkWeights);
```

## Admin Interface Usage Pattern

```javascript
// 1. Load asset class list
const assetClasses = await getAssetClasses(); // Your function

// 2. Load current weights for selected asset class
const selectedAssetClassId = 'uuid-123';
const currentWeights = await getWeightsForAssetClass(selectedAssetClassId);

// 3. Show weight sliders with current values
renderWeightSliders(currentWeights);

// 4. On slider change (real-time preview)
function onWeightChange(metric, newValue) {
  const updatedWeights = { ...currentWeights, [metric]: newValue };
  
  // Validate
  const validation = validateWeights(updatedWeights);
  showValidationFeedback(validation);
  
  // Show real-time preview
  const previewScores = calculateScores(sampleFunds, { 
    [selectedAssetClassName]: updatedWeights 
  });
  updatePreviewTable(previewScores);
}

// 5. Save weights
async function saveWeights(finalWeights) {
  const success = await saveAssetClassWeights(selectedAssetClassId, finalWeights);
  if (success) {
    showSuccessMessage('Weights saved successfully');
  }
}

// 6. Reset to defaults
async function resetWeights() {
  const success = await resetAssetClassWeights(selectedAssetClassId);
  if (success) {
    const defaultWeights = getGlobalDefaultWeights();
    renderWeightSliders(defaultWeights);
  }
}
```

## Performance Characteristics

- **Weight Loading**: ~1-5ms per asset class
- **Bulk Loading**: ~5-10ms for multiple asset classes
- **Scoring Integration**: No performance impact
- **Real-time Capable**: Suitable for slider feedback loops

## Error Handling

The service handles errors gracefully:

- **Database unavailable**: Falls back to global defaults
- **Invalid asset class ID**: Returns global defaults
- **Validation errors**: Throws with descriptive messages
- **Partial data**: Merges available custom weights with defaults

## Best Practices

1. **Cache weights** in admin interface to avoid repeated DB calls
2. **Validate weights** before saving to prevent invalid configurations
3. **Use bulk loading** when working with multiple asset classes
4. **Show weight differences** to help users understand customizations
5. **Provide reset functionality** to easily revert to defaults

## Migration from Existing System

The new weight service can run alongside the existing complex scoring system:

1. Load weights using new service
2. Pass to new scoring service for calculation
3. Compare results with existing system
4. Gradually migrate admin interfaces
5. Eventually replace old system entirely