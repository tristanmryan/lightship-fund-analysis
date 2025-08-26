import { useState, useCallback, useMemo } from 'react';

/**
 * Table selection hook for managing row selection state
 * Supports both single fund selection and multi-row selection patterns
 */
export function useTableSelection({
  data = [],
  initialSelection = null,
  selectionMode = 'single', // 'single', 'multiple', 'none'
  maxSelection = null, // null = unlimited, number = max allowed
  onSelectionChange = null,
  selectionKey = 'id', // Property to use as unique identifier
  fallbackKeys = ['ticker', 'symbol', 'Symbol'] // Fallback keys for identification
} = {}) {
  const [selectedItems, setSelectedItems] = useState(() => {
    if (initialSelection) {
      return Array.isArray(initialSelection) ? initialSelection : [initialSelection];
    }
    return [];
  });

  const [lastSelectedItem, setLastSelectedItem] = useState(null);

  // Get unique identifier for an item
  const getItemKey = useCallback((item) => {
    if (!item) return null;
    
    // Try primary key first
    if (item[selectionKey] !== undefined) {
      return item[selectionKey];
    }
    
    // Try fallback keys
    for (const fallbackKey of fallbackKeys) {
      if (item[fallbackKey] !== undefined) {
        return item[fallbackKey];
      }
    }
    
    // Fallback to index if no unique identifier found
    return data.indexOf(item);
  }, [selectionKey, fallbackKeys, data]);

  // Check if an item is selected
  const isSelected = useCallback((item) => {
    const itemKey = getItemKey(item);
    if (itemKey === null) return false;
    
    return selectedItems.some(selectedItem => getItemKey(selectedItem) === itemKey);
  }, [selectedItems, getItemKey]);

  // Select a single item
  const selectItem = useCallback((item, addToSelection = false) => {
    if (selectionMode === 'none') return;
    
    const itemKey = getItemKey(item);
    if (itemKey === null) return;

    setSelectedItems(prevSelection => {
      let newSelection;

      if (selectionMode === 'single') {
        // Single selection mode - replace current selection
        newSelection = [item];
      } else if (selectionMode === 'multiple') {
        if (addToSelection) {
          // Add to existing selection
          const isAlreadySelected = prevSelection.some(selectedItem => 
            getItemKey(selectedItem) === itemKey
          );
          
          if (isAlreadySelected) {
            // Remove if already selected
            newSelection = prevSelection.filter(selectedItem => 
              getItemKey(selectedItem) !== itemKey
            );
          } else {
            // Add to selection
            if (maxSelection && prevSelection.length >= maxSelection) {
              // Remove oldest selection if at max
              newSelection = [...prevSelection.slice(1), item];
            } else {
              newSelection = [...prevSelection, item];
            }
          }
        } else {
          // Replace current selection
          newSelection = [item];
        }
      } else {
        newSelection = [item];
      }

      setLastSelectedItem(item);
      
      if (onSelectionChange) {
        onSelectionChange(newSelection, item, 'select');
      }

      return newSelection;
    });
  }, [selectionMode, maxSelection, onSelectionChange, getItemKey]);

  // Deselect a specific item
  const deselectItem = useCallback((item) => {
    const itemKey = getItemKey(item);
    if (itemKey === null) return;

    setSelectedItems(prevSelection => {
      const newSelection = prevSelection.filter(selectedItem => 
        getItemKey(selectedItem) !== itemKey
      );
      
      if (onSelectionChange) {
        onSelectionChange(newSelection, item, 'deselect');
      }

      return newSelection;
    });
  }, [onSelectionChange, getItemKey]);

  // Toggle selection of an item
  const toggleItem = useCallback((item) => {
    if (isSelected(item)) {
      deselectItem(item);
    } else {
      selectItem(item, selectionMode === 'multiple');
    }
  }, [isSelected, deselectItem, selectItem, selectionMode]);

  // Select multiple items
  const selectMultiple = useCallback((items, replace = true) => {
    if (selectionMode === 'none') return;
    
    const validItems = items.filter(item => getItemKey(item) !== null);
    
    if (maxSelection && validItems.length > maxSelection) {
      validItems.splice(maxSelection);
    }

    setSelectedItems(prevSelection => {
      const newSelection = replace ? validItems : [...prevSelection, ...validItems];
      
      if (onSelectionChange) {
        onSelectionChange(newSelection, validItems, 'select-multiple');
      }

      return newSelection;
    });
  }, [selectionMode, maxSelection, onSelectionChange, getItemKey]);

  // Clear all selections
  const clearSelection = useCallback(() => {
    setSelectedItems([]);
    setLastSelectedItem(null);
    
    if (onSelectionChange) {
      onSelectionChange([], null, 'clear');
    }
  }, [onSelectionChange]);

  // Select all items (respecting maxSelection)
  const selectAll = useCallback(() => {
    if (selectionMode === 'none') return;
    
    const allItems = maxSelection ? data.slice(0, maxSelection) : data;
    setSelectedItems(allItems);
    
    if (onSelectionChange) {
      onSelectionChange(allItems, null, 'select-all');
    }
  }, [data, selectionMode, maxSelection, onSelectionChange]);

  // Select items by condition
  const selectByCondition = useCallback((condition) => {
    if (selectionMode === 'none') return;
    
    const matchingItems = data.filter(condition);
    const validItems = maxSelection ? matchingItems.slice(0, maxSelection) : matchingItems;
    
    setSelectedItems(validItems);
    
    if (onSelectionChange) {
      onSelectionChange(validItems, null, 'select-by-condition');
    }
  }, [data, selectionMode, maxSelection, onSelectionChange]);

  // Get selection statistics
  const selectionStats = useMemo(() => {
    const total = data.length;
    const selected = selectedItems.length;
    const percentage = total > 0 ? Math.round((selected / total) * 100) : 0;
    
    return {
      total,
      selected,
      percentage,
      isEmpty: selected === 0,
      isFull: selected === total,
      canSelectMore: maxSelection ? selected < maxSelection : true
    };
  }, [data.length, selectedItems.length, maxSelection]);

  // Get selected item keys for easy comparison
  const selectedKeys = useMemo(() => {
    return selectedItems.map(item => getItemKey(item)).filter(Boolean);
  }, [selectedItems, getItemKey]);

  // Check if selection is valid
  const isValidSelection = useMemo(() => {
    if (selectionMode === 'none') return false;
    if (maxSelection && selectedItems.length > maxSelection) return false;
    return true;
  }, [selectionMode, maxSelection, selectedItems.length]);

  return {
    // Selection state
    selectedItems,
    selectedKeys,
    lastSelectedItem,
    selectionStats,
    isValidSelection,
    
    // Selection methods
    selectItem,
    deselectItem,
    toggleItem,
    selectMultiple,
    clearSelection,
    selectAll,
    selectByCondition,
    
    // Utility methods
    isSelected,
    getItemKey,
    
    // Selection info
    hasSelection: selectedItems.length > 0,
    selectionCount: selectedItems.length,
    canSelectMore: selectionStats.canSelectMore
  };
}

/**
 * Hook for managing fund-specific selection patterns
 * Compatible with existing onFundSelect pattern
 */
export function useFundSelection({
  data = [],
  onFundSelect = null,
  selectionMode = 'single',
  ...options
} = {}) {
  const selectionHook = useTableSelection({
    data,
    selectionMode,
    ...options
  });

  // Enhanced fund selection with onFundSelect callback
  const selectFund = useCallback((fund) => {
    selectionHook.selectItem(fund);
    
    // Call the original onFundSelect callback if provided
    if (onFundSelect) {
      onFundSelect(fund);
    }
  }, [selectionHook, onFundSelect]);

  // Enhanced toggle for fund selection
  const toggleFund = useCallback((fund) => {
    if (selectionHook.isSelected(fund)) {
      selectionHook.deselectItem(fund);
    } else {
      selectFund(fund);
    }
  }, [selectionHook, selectFund]);

  return {
    ...selectionHook,
    selectFund,
    toggleFund,
    // Maintain compatibility with existing patterns
    onFundSelect: selectFund
  };
}

/**
 * Hook for managing table row selection with keyboard support
 */
export function useTableRowSelection({
  data = [],
  selectionMode = 'multiple',
  enableKeyboard = true,
  ...options
} = {}) {
  const selectionHook = useTableSelection({
    data,
    selectionMode,
    ...options
  });

  const [focusedIndex, setFocusedIndex] = useState(-1);

  // Keyboard navigation and selection
  const handleKeyDown = useCallback((event, currentIndex) => {
    if (!enableKeyboard) return;

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedIndex(prev => Math.min(prev + 1, data.length - 1));
        break;
        
      case 'ArrowUp':
        event.preventDefault();
        setFocusedIndex(prev => Math.max(prev - 1, 0));
        break;
        
      case ' ':
      case 'Enter':
        event.preventDefault();
        if (currentIndex >= 0 && currentIndex < data.length) {
          selectionHook.toggleItem(data[currentIndex]);
        }
        break;
        
      case 'Escape':
        event.preventDefault();
        setFocusedIndex(-1);
        break;
        
      default:
        break;
    }
  }, [data, selectionHook, enableKeyboard]);

  // Select range of items (Shift+Click)
  const selectRange = useCallback((startIndex, endIndex) => {
    if (selectionMode !== 'multiple') return;
    
    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);
    const rangeItems = data.slice(start, end + 1);
    
    selectionHook.selectMultiple(rangeItems, false);
  }, [data, selectionMode, selectionHook]);

  // Get focused item
  const focusedItem = useMemo(() => {
    return focusedIndex >= 0 && focusedIndex < data.length ? data[focusedIndex] : null;
  }, [data, focusedIndex]);

  return {
    ...selectionHook,
    focusedIndex,
    focusedItem,
    setFocusedIndex,
    handleKeyDown,
    selectRange
  };
}

/**
 * Preset selection patterns for common use cases
 */
export const SELECTION_PRESETS = {
  recommended: {
    name: 'Recommended Funds',
    description: 'Select all recommended funds',
    condition: (fund) => fund.is_recommended || fund.recommended
  },
  
  highPerformers: {
    name: 'High Performers',
    description: 'Select funds with high scores and returns',
    condition: (fund) => {
      const score = fund.scores?.final || fund.score || 0;
      const ytdReturn = fund.ytd_return ?? fund['Total Return - YTD (%)'] ?? 0;
      return score >= 7 && ytdReturn > 0.05;
    }
  },
  
  lowCost: {
    name: 'Low Cost Funds',
    description: 'Select funds with low expense ratios',
    condition: (fund) => {
      const expenseRatio = fund.expense_ratio ?? fund['Net Exp Ratio (%)'] ?? 1;
      return expenseRatio <= 0.01; // 1% or less
    }
  },
  
  topScorers: {
    name: 'Top Scorers',
    description: 'Select top 10 scoring funds',
    condition: (fund, index) => index < 10,
    maxSelection: 10
  }
};

/**
 * Hook for managing preset-based selection
 */
export function usePresetSelection(baseSelectionHook) {
  const applyPreset = useCallback((presetKey) => {
    const preset = SELECTION_PRESETS[presetKey];
    if (!preset) return;
    
    baseSelectionHook.selectByCondition(preset.condition);
  }, [baseSelectionHook]);

  return {
    applyPreset,
    availablePresets: SELECTION_PRESETS
  };
} 