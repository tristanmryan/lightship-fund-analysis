import React, { useState } from 'react';
import ModernFundTable from './ModernFundTable';

/**
 * Modern Fund Table Demo Component
 * Showcases the new modern fund table with sample data
 */
const ModernFundTableDemo = () => {
  // Sample fund data for demonstration
  const sampleFunds = [
    {
      ticker: 'FCNTX',
      name: 'Fidelity Contrafund',
      asset_class_name: 'Large Growth',
      scores: { final: 85.2 },
      ytd_return: 12.5,
      one_year_return: 18.3,
      three_year_return: 15.7,
      expense_ratio: 0.86,
      sharpe_ratio: 1.2,
      is_recommended: true,
      isBenchmark: false
    },
    {
      ticker: 'IWF',
      name: 'iShares Russell 1000 Growth ETF',
      asset_class_name: 'Large Growth',
      scores: { final: 72.1 },
      ytd_return: 10.2,
      one_year_return: 16.8,
      three_year_return: 14.2,
      expense_ratio: 0.19,
      sharpe_ratio: 0.95,
      is_recommended: false,
      isBenchmark: true
    },
    {
      ticker: 'FZANX',
      name: 'Fidelity ZERO Total Market Index Fund',
      asset_class_name: 'Large Blend',
      scores: { final: 78.9 },
      ytd_return: 11.8,
      one_year_return: 17.2,
      three_year_return: 15.1,
      expense_ratio: 0.00,
      sharpe_ratio: 1.05,
      is_recommended: true,
      isBenchmark: false
    },
    {
      ticker: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      asset_class_name: 'Large Blend',
      scores: { final: 75.4 },
      ytd_return: 11.5,
      one_year_return: 16.9,
      three_year_return: 14.8,
      expense_ratio: 0.03,
      sharpe_ratio: 1.02,
      is_recommended: false,
      isBenchmark: false
    },
    {
      ticker: 'AGG',
      name: 'iShares Core U.S. Aggregate Bond ETF',
      asset_class_name: 'Intermediate Core Bond',
      scores: { final: 65.3 },
      ytd_return: 3.2,
      one_year_return: 4.1,
      three_year_return: 2.8,
      expense_ratio: 0.04,
      sharpe_ratio: 0.45,
      is_recommended: false,
      isBenchmark: true
    },
    {
      ticker: 'VXUS',
      name: 'Vanguard Total International Stock ETF',
      asset_class_name: 'Foreign Large Blend',
      scores: { final: 68.7 },
      ytd_return: 8.9,
      one_year_return: 12.4,
      three_year_return: 10.2,
      expense_ratio: 0.08,
      sharpe_ratio: 0.78,
      is_recommended: true,
      isBenchmark: false
    },
    {
      ticker: 'QQQ',
      name: 'Invesco QQQ Trust',
      asset_class_name: 'Large Growth',
      scores: { final: 82.1 },
      ytd_return: 15.3,
      one_year_return: 22.7,
      three_year_return: 19.4,
      expense_ratio: 0.20,
      sharpe_ratio: 1.15,
      is_recommended: true,
      isBenchmark: false
    },
    {
      ticker: 'SPY',
      name: 'SPDR S&P 500 ETF Trust',
      asset_class_name: 'Large Blend',
      scores: { final: 73.8 },
      ytd_return: 11.2,
      one_year_return: 16.5,
      three_year_return: 14.6,
      expense_ratio: 0.09,
      sharpe_ratio: 0.98,
      is_recommended: false,
      isBenchmark: true
    }
  ];

  const [funds] = useState(sampleFunds);

  const handleFundSelect = (fund) => {
    console.log('Selected fund:', fund);
    // In a real app, this would open a fund details modal or navigate to fund details
  };

  const handleTableStateChange = (state) => {
    console.log('Table state changed:', state);
    // In a real app, this would persist the table state
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Modern Fund Table Demo
          </h1>
          <p className="text-lg text-gray-600">
            Showcasing the new modern fund table with clean visual indicators and improved UX
          </p>
        </div>

        {/* Key Features */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <span className="text-emerald-600 text-lg">✓</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Clean Ticker Display</h3>
            </div>
            <p className="text-gray-600">
              Ticker symbols are displayed cleanly without appended labels. Status is shown through modern visual indicators.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600 text-lg">★</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Visual Status Indicators</h3>
            </div>
            <p className="text-gray-600">
              Recommended funds and benchmarks are clearly distinguished with badges, colors, and styling.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600 text-lg">⚡</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Modern UX</h3>
            </div>
            <p className="text-gray-600">
              Professional appearance with hover effects, smooth transitions, and intuitive interactions.
            </p>
          </div>
        </div>

        {/* Modern Fund Table */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Fund Analysis Table
            </h2>
            <p className="text-gray-600">
              This table demonstrates the new modern design with:
            </p>
            <ul className="mt-2 text-sm text-gray-600 space-y-1">
              <li>• Clean ticker symbols (FCNTX, IWF, FZANX, etc.)</li>
              <li>• Visual status badges for recommended and benchmark funds</li>
              <li>• Distinct row styling for different fund types</li>
              <li>• Modern color scheme and typography</li>
              <li>• Responsive design and accessibility features</li>
            </ul>
          </div>
          
          <ModernFundTable
            funds={funds}
            onFundSelect={handleFundSelect}
            onStateChange={handleTableStateChange}
            initialSortConfig={[{ key: 'score', direction: 'desc' }]}
            initialSelectedColumns={[
              'symbol', 'name', 'assetClass', 'score', 'ytdReturn', 
              'oneYearReturn', 'threeYearReturn', 'expenseRatio', 'sharpeRatio'
            ]}
          />
        </div>

        {/* Status Legend */}
        <div className="mt-8 bg-white p-6 rounded-lg border border-gray-200 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Status Indicators</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Fund Types</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-emerald-100 border-l-4 border-emerald-500"></div>
                  <span className="text-sm text-gray-600">Recommended Funds</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-blue-100 border-l-4 border-blue-500 italic"></div>
                  <span className="text-sm text-gray-600">Benchmark Funds</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-4 h-4 bg-white border-l-4 border-gray-300"></div>
                  <span className="text-sm text-gray-600">Regular Funds</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700 mb-3">Visual Elements</h4>
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <span className="text-emerald-600">★</span>
                    Recommended
                  </div>
                  <span className="text-sm text-gray-600">Status badge</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                    <span className="text-blue-600">🎯</span>
                    Benchmark
                  </div>
                  <span className="text-sm text-gray-600">Status badge</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold text-white" style={{ backgroundColor: '#10b981' }}>
                    85.2
                  </div>
                  <span className="text-sm text-gray-600">Score indicator</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernFundTableDemo; 