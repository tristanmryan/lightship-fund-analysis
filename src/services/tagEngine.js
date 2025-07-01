// src/services/tagEngine.js

/**
 * Tag Engine Service
 * Manages automatic and manual tagging of funds based on performance criteria
 */

// Default tag rules
export const DEFAULT_TAG_RULES = [
    {
      id: 'top_performer',
      name: 'Top Performer',
      description: 'Fund score in top 10% of asset class',
      condition: (fund, context) => {
        return fund.scores?.percentile >= 90;
      },
      color: '#059669',
      icon: '🏆',
      priority: 1
    },
    {
      id: 'outperformer',
      name: 'Outperformer',
      description: 'Score above 70',
      condition: (fund, context) => {
        return fund.scores?.final > 70;
      },
      color: '#16a34a',
      icon: '✓',
      priority: 2
    },
    {
      id: 'underperformer',
      name: 'Underperformer', 
      description: 'Score below 40',
      condition: (fund, context) => {
        return fund.scores?.final < 40;
      },
      color: '#dc2626',
      icon: '⚠',
      priority: 3
    },
    {
      id: 'expensive',
      name: 'Expensive',
      description: 'Expense ratio above asset class average by 50%',
      condition: (fund, context) => {
        const avgExpense = context.assetClassAverages[fund['Asset Class']]?.avgExpense;
        return avgExpense && fund['Net Expense Ratio'] > avgExpense * 1.5;
      },
      color: '#f59e0b',
      icon: '💰',
      priority: 4
    },
    {
      id: 'high_risk',
      name: 'High Risk',
      description: 'Standard deviation above asset class average by 20%',
      condition: (fund, context) => {
        const avgStdDev = context.assetClassAverages[fund['Asset Class']]?.avgStdDev;
        return avgStdDev && fund['Standard Deviation'] > avgStdDev * 1.2;
      },
      color: '#ef4444',
      icon: '📊',
      priority: 5
    },
    {
      id: 'poor_sharpe',
      name: 'Poor Risk-Adjusted Returns',
      description: 'Sharpe ratio below 0.5',
      condition: (fund, context) => {
        return fund['Sharpe Ratio'] != null && fund['Sharpe Ratio'] < 0.5;
      },
      color: '#e11d48',
      icon: '📉',
      priority: 6
    },
    {
      id: 'beats_benchmark',
      name: 'Beats Benchmark',
      description: 'Score higher than asset class benchmark',
      condition: (fund, context) => {
        const benchmark = context.benchmarks[fund['Asset Class']];
        return benchmark && fund.scores?.final > benchmark.scores?.final;
      },
      color: '#0891b2',
      icon: '🎯',
      priority: 7
    },
    {
      id: 'consistent',
      name: 'Consistent Performer',
      description: 'Low volatility in historical scores',
      condition: (fund, context) => {
        // This would need historical data to calculate
        // For now, use a proxy: good score with low std dev
        return fund.scores?.final >= 60 && 
               fund['Standard Deviation'] != null &&
               fund['Standard Deviation'] < 10;
      },
      color: '#6366f1',
      icon: '🎯',
      priority: 8
    },
    {
      id: 'new_manager',
      name: 'New Management',
      description: 'Manager tenure less than 2 years',
      condition: (fund, context) => {
        return fund['Manager Tenure'] != null && fund['Manager Tenure'] < 2;
      },
      color: '#8b5cf6',
      icon: '👤',
      priority: 9
    },
    {
      id: 'recommended_watch',
      name: 'Recommended - Watch',
      description: 'Recommended fund with score below 50',
      condition: (fund, context) => {
        return fund.isRecommended && fund.scores?.final < 50;
      },
      color: '#dc2626',
      icon: '👁️',
      priority: 1 // High priority for recommended funds needing attention
    }
  ];
  
  // Tag categories
  export const TAG_CATEGORIES = {
    PERFORMANCE: 'Performance',
    RISK: 'Risk',
    COST: 'Cost',
    MANAGEMENT: 'Management',
    CUSTOM: 'Custom'
  };
  
  // Map tags to categories
  export const TAG_CATEGORY_MAP = {
    'top_performer': TAG_CATEGORIES.PERFORMANCE,
    'outperformer': TAG_CATEGORIES.PERFORMANCE,
    'underperformer': TAG_CATEGORIES.PERFORMANCE,
    'beats_benchmark': TAG_CATEGORIES.PERFORMANCE,
    'consistent': TAG_CATEGORIES.PERFORMANCE,
    'high_risk': TAG_CATEGORIES.RISK,
    'poor_sharpe': TAG_CATEGORIES.RISK,
    'expensive': TAG_CATEGORIES.COST,
    'new_manager': TAG_CATEGORIES.MANAGEMENT,
    'recommended_watch': TAG_CATEGORIES.MANAGEMENT
  };
  
  /**
   * Apply tag rules to funds
   * @param {Array<Object>} funds - Array of fund objects
   * @param {Object} context - Context data (benchmarks, averages, etc.)
   * @param {Array<Object>} customRules - Additional custom rules
   * @returns {Array<Object>} Funds with tags applied
   */
  export function applyTagRules(funds, context = {}, customRules = []) {
    const allRules = [...DEFAULT_TAG_RULES, ...customRules];
    
    // Calculate asset class averages if not provided
    if (!context.assetClassAverages) {
      context.assetClassAverages = calculateAssetClassAverages(funds);
    }
    
    // Apply rules to each fund
    return funds.map(fund => {
      const tags = [];
      
      // Check each rule
      allRules.forEach(rule => {
        try {
          if (rule.condition(fund, context)) {
            tags.push({
              id: rule.id,
              name: rule.name,
              color: rule.color,
              icon: rule.icon,
              priority: rule.priority,
              category: TAG_CATEGORY_MAP[rule.id] || TAG_CATEGORIES.CUSTOM
            });
          }
        } catch (error) {
          console.error(`Error applying rule ${rule.id}:`, error);
        }
      });
      
      // Sort tags by priority
      tags.sort((a, b) => a.priority - b.priority);
      
      return {
        ...fund,
        autoTags: tags
      };
    });
  }
  
  /**
   * Calculate asset class averages for context
   * @param {Array<Object>} funds - Array of funds
   * @returns {Object} Averages by asset class
   */
  function calculateAssetClassAverages(funds) {
    const averages = {};
    
    // Group by asset class
    const fundsByClass = {};
    funds.forEach(fund => {
      const assetClass = fund['Asset Class'] || 'Unknown';
      if (!fundsByClass[assetClass]) {
        fundsByClass[assetClass] = [];
      }
      fundsByClass[assetClass].push(fund);
    });
    
    // Calculate averages for each class
    Object.entries(fundsByClass).forEach(([assetClass, classFunds]) => {
      const expenses = classFunds
        .map(f => f['Net Expense Ratio'])
        .filter(e => e != null);
      
      const stdDevs = classFunds
        .map(f => f['Standard Deviation'])
        .filter(s => s != null);
      
      const sharpes = classFunds
        .map(f => f['Sharpe Ratio'])
        .filter(s => s != null);
      
      averages[assetClass] = {
        avgExpense: expenses.length > 0 
          ? expenses.reduce((a, b) => a + b, 0) / expenses.length 
          : null,
        avgStdDev: stdDevs.length > 0
          ? stdDevs.reduce((a, b) => a + b, 0) / stdDevs.length
          : null,
        avgSharpe: sharpes.length > 0
          ? sharpes.reduce((a, b) => a + b, 0) / sharpes.length
          : null,
        fundCount: classFunds.length
      };
    });
    
    return averages;
  }
  
  /**
   * Create a custom tag rule
   * @param {Object} ruleConfig - Rule configuration
   * @returns {Object} Tag rule
   */
  export function createCustomRule(ruleConfig) {
    return {
      id: ruleConfig.id || `custom_${Date.now()}`,
      name: ruleConfig.name,
      description: ruleConfig.description,
      condition: ruleConfig.condition,
      color: ruleConfig.color || '#6b7280',
      icon: ruleConfig.icon || '🏷️',
      priority: ruleConfig.priority || 99
    };
  }
  
  /**
   * Get tag statistics for a set of funds
   * @param {Array<Object>} funds - Funds with tags
   * @returns {Object} Tag statistics
   */
  export function getTagStatistics(funds) {
    const stats = {
      totalTags: 0,
      tagCounts: {},
      categoryCounts: {},
      fundsByTag: {},
      untaggedFunds: []
    };
    
    funds.forEach(fund => {
      const tags = fund.autoTags || [];
      
      if (tags.length === 0) {
        stats.untaggedFunds.push(fund);
      }
      
      tags.forEach(tag => {
        stats.totalTags++;
        
        // Count by tag
        if (!stats.tagCounts[tag.id]) {
          stats.tagCounts[tag.id] = 0;
          stats.fundsByTag[tag.id] = [];
        }
        stats.tagCounts[tag.id]++;
        stats.fundsByTag[tag.id].push(fund);
        
        // Count by category
        if (!stats.categoryCounts[tag.category]) {
          stats.categoryCounts[tag.category] = 0;
        }
        stats.categoryCounts[tag.category]++;
      });
    });
    
    return stats;
  }
  
  /**
   * Filter funds by tags
   * @param {Array<Object>} funds - Funds with tags
   * @param {Array<string>} tagIds - Tag IDs to filter by
   * @param {string} mode - Filter mode ('any' or 'all')
   * @returns {Array<Object>} Filtered funds
   */
  export function filterByTags(funds, tagIds, mode = 'any') {
    if (!tagIds || tagIds.length === 0) return funds;
    
    return funds.filter(fund => {
      const fundTagIds = (fund.autoTags || []).map(t => t.id);
      
      if (mode === 'all') {
        // Fund must have all specified tags
        return tagIds.every(tagId => fundTagIds.includes(tagId));
      } else {
        // Fund must have at least one specified tag
        return tagIds.some(tagId => fundTagIds.includes(tagId));
      }
    });
  }
  
  /**
   * Get suggested actions based on tags
   * @param {Object} fund - Fund with tags
   * @returns {Array<string>} Suggested actions
   */
  export function getSuggestedActions(fund) {
    const actions = [];
    const tags = fund.autoTags || [];
    
    tags.forEach(tag => {
      switch (tag.id) {
        case 'underperformer':
        case 'poor_sharpe':
          actions.push('Consider for replacement');
          break;
        case 'expensive':
          actions.push('Look for lower-cost alternatives');
          break;
        case 'high_risk':
          actions.push('Review risk tolerance and allocation');
          break;
        case 'new_manager':
          actions.push('Monitor performance closely');
          break;
        case 'recommended_watch':
          actions.push('Review at next investment committee meeting');
          break;
      }
    });
    
    // Remove duplicates
    return [...new Set(actions)];
  }
  
  /**
   * Export tag rules for backup/sharing
   * @param {Array<Object>} rules - Tag rules to export
   * @returns {string} JSON string of rules
   */
  export function exportTagRules(rules = DEFAULT_TAG_RULES) {
    // Convert function conditions to strings for export
    const exportableRules = rules.map(rule => ({
      ...rule,
      condition: rule.condition.toString()
    }));
    
    return JSON.stringify(exportableRules, null, 2);
  }
  
  /**
   * Import tag rules from JSON
   * @param {string} jsonString - JSON string of rules
   * @returns {Array<Object>} Imported rules
   */
  export function importTagRules(jsonString) {
    try {
      const rules = JSON.parse(jsonString);
      
      // Convert string conditions back to functions
      return rules.map(rule => ({
        ...rule,
        condition: new Function('fund', 'context', rule.condition)
      }));
    } catch (error) {
      console.error('Error importing tag rules:', error);
      return [];
    }
  }
  
  export default {
    DEFAULT_TAG_RULES,
    TAG_CATEGORIES,
    TAG_CATEGORY_MAP,
    applyTagRules,
    createCustomRule,
    getTagStatistics,
    filterByTags,
    getSuggestedActions,
    exportTagRules,
    importTagRules
  };