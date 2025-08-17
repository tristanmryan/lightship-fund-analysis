// src/components/Dashboard/AssetClassTable.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Download, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { getScoreColor } from '../../services/scoring';
import fundService from '../../services/fundService';
import asOfStore from '../../services/asOfStore';
import scoringProfilesService from '../../services/scoringProfilesService';
import { exportAssetClassTableCSV } from '../../services/exportService';
import { fmt } from '../../utils/formatters';

/**
 * Asset Class Table Component
 * Displays funds for a specific asset class with scores and benchmark row
 */
const AssetClassTable = ({ 
  assetClassId, 
  assetClassName = 'Asset Class',
  onExport 
}) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('score_final');
  const [sortDirection, setSortDirection] = useState('desc');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [asOfMonth, setAsOfMonth] = useState(null);

  // Load profiles and data
  useEffect(() => {
    const loadProfiles = async () => {
      try {
        const profileList = await scoringProfilesService.listProfiles();
        setProfiles(profileList);
        
        // Get default profile
        const defaultProfile = await scoringProfilesService.getDefaultProfile();
        setSelectedProfile(defaultProfile);
      } catch (err) {
        console.error('Error loading scoring profiles:', err);
      }
    };

    loadProfiles();
  }, []);

  // Subscribe to asOfStore changes
  useEffect(() => {
    const unsubscribe = asOfStore.subscribe(() => {
      setAsOfMonth(asOfStore.activeMonth);
    });

    // Set initial value
    setAsOfMonth(asOfStore.activeMonth);

    return unsubscribe;
  }, []);

  // Load asset class data
  useEffect(() => {
    const loadData = async () => {
      if (!asOfMonth) return;

      // Handle case where asset class ID is missing (legacy data)
      if (!assetClassId) {
        setLoading(false);
        setError(`Asset class "${assetClassName}" is not configured in the database yet. Please import data using the Admin tab to set up this asset class.`);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const tableData = await fundService.getAssetClassTable(
          asOfMonth, 
          assetClassId, 
          true // include benchmark
        );
        
        setData(tableData || []);
      } catch (err) {
        console.error('Error loading asset class table:', err);
        setError('Failed to load asset class data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [assetClassId, assetClassName, asOfMonth, selectedProfile]);

  // Sorted data
  const sortedData = useMemo(() => {
    if (!data.length) return [];

    // Separate funds and benchmarks
    const funds = data.filter(row => !row.is_benchmark);
    const benchmarks = data.filter(row => row.is_benchmark);

    // Sort funds
    const sortedFunds = [...funds].sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle null values
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      // Sort numerically for numeric fields
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      // Sort alphabetically for strings
      const result = String(aVal).localeCompare(String(bVal));
      return sortDirection === 'asc' ? result : -result;
    });

    // Return funds first, then benchmarks (benchmarks always at the end)
    return [...sortedFunds, ...benchmarks];
  }, [data, sortBy, sortDirection]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDirection('desc');
    }
  };

  const handleExport = () => {
    try {
      exportAssetClassTableCSV(sortedData, assetClassName, asOfMonth);
    } catch (error) {
      console.error('Error exporting data:', error);
      // Could add user notification here
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return <ArrowUpDown className="w-4 h-4" />;
    return sortDirection === 'asc' ? 
      <ArrowUp className="w-4 h-4" /> : 
      <ArrowDown className="w-4 h-4" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-gray-500">Loading asset class data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-700">{error}</div>
      </div>
    );
  }

  if (!sortedData.length) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <div className="text-gray-500">No data available for this asset class</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">{assetClassName} Performance</h3>
          
          {/* Scoring Profile Selector */}
          {profiles.length > 0 && (
            <select
              value={selectedProfile?.id || ''}
              onChange={(e) => {
                const profile = profiles.find(p => p.id === e.target.value);
                setSelectedProfile(profile);
              }}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm"
            >
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600">
            As of: {fmt.date(asOfMonth)}
          </span>
          
          <button
            onClick={handleExport}
            className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Performance Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('ticker')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Ticker</span>
                  {getSortIcon('ticker')}
                </button>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('score_final')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Score</span>
                  {getSortIcon('score_final')}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('ytd_return')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>YTD</span>
                  {getSortIcon('ytd_return')}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('one_year_return')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>1Y</span>
                  {getSortIcon('one_year_return')}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('three_year_return')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>3Y</span>
                  {getSortIcon('three_year_return')}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('five_year_return')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>5Y</span>
                  {getSortIcon('five_year_return')}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('sharpe_ratio')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Sharpe</span>
                  {getSortIcon('sharpe_ratio')}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('expense_ratio')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>ER</span>
                  {getSortIcon('expense_ratio')}
                </button>
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                <button
                  onClick={() => handleSort('standard_deviation_3y')}
                  className="flex items-center space-x-1 hover:text-gray-700"
                >
                  <span>Std Dev</span>
                  {getSortIcon('standard_deviation_3y')}
                </button>
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((row, index) => (
              <tr 
                key={`${row.ticker}-${index}`}
                className={`
                  ${row.is_benchmark ? 'bg-blue-50 border-t-2 border-blue-200' : 'hover:bg-gray-50'}
                  ${row.is_recommended ? 'bg-green-50' : ''}
                `}
              >
                <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                  {row.ticker}
                  {row.is_benchmark && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                      Benchmark
                    </span>
                  )}
                  {row.is_recommended && !row.is_benchmark && (
                    <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                      Recommended
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 max-w-xs truncate">
                  {row.name}
                </td>
                <td className="px-4 py-3 text-center text-sm">
                  {row.score_final != null && !row.is_benchmark ? (
                    <span 
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium text-white"
                      style={{ backgroundColor: getScoreColor(row.score_final) }}
                    >
                      {Math.round(row.score_final)}
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {fmt.percent(row.ytd_return)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {fmt.percent(row.one_year_return)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {fmt.percent(row.three_year_return)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {fmt.percent(row.five_year_return)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {fmt.number(row.sharpe_ratio)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {fmt.percent(row.expense_ratio)}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-900">
                  {fmt.percent(row.standard_deviation_3y)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="text-sm text-gray-600">
        Showing {sortedData.filter(r => !r.is_benchmark).length} funds
        {sortedData.some(r => r.is_benchmark) && ' with 1 benchmark'}
      </div>
    </div>
  );
};

export default AssetClassTable;