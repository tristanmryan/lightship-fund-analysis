// src/components/Dashboard/ScoreAnalysisDemo.jsx
import React from 'react';
import ScoreAnalysisSection from './ScoreAnalysisSection';

/**
 * Demo component to showcase the new Score Analysis components
 * This can be used for testing and demonstration purposes
 */
const ScoreAnalysisDemo = () => {
  // Mock fund data for demonstration
  const demoFund = {
    ticker: 'VTSAX',
    Symbol: 'VTSAX',
    scores: {
      final: 78.5,
      breakdown: {
        ytd: {
          value: 0.085,
          zScore: 1.2,
          weight: 0.025,
          weightedZScore: 0.03,
          reweightedContribution: 0.03,
          percentile: 85,
          coverage: 0.95,
          weightSource: 'resolved'
        },
        oneYear: {
          value: 0.125,
          zScore: 1.5,
          weight: 0.05,
          weightedZScore: 0.075,
          reweightedContribution: 0.075,
          percentile: 90,
          coverage: 0.98,
          weightSource: 'resolved'
        },
        threeYear: {
          value: 0.089,
          zScore: 1.1,
          weight: 0.10,
          weightedZScore: 0.11,
          reweightedContribution: 0.11,
          percentile: 80,
          coverage: 0.92,
          weightSource: 'resolved'
        },
        sharpeRatio3Y: {
          value: 1.25,
          zScore: 0.8,
          weight: 0.10,
          weightedZScore: 0.08,
          reweightedContribution: 0.08,
          percentile: 70,
          coverage: 0.88,
          weightSource: 'resolved'
        },
        stdDev3Y: {
          value: 0.15,
          zScore: -0.5,
          weight: -0.075,
          weightedZScore: 0.0375,
          reweightedContribution: 0.0375,
          percentile: 30,
          coverage: 0.85,
          weightSource: 'resolved'
        },
        upCapture3Y: {
          value: 0.95,
          zScore: 0.6,
          weight: 0.075,
          weightedZScore: 0.045,
          reweightedContribution: 0.045,
          percentile: 65,
          coverage: 0.90,
          weightSource: 'resolved'
        },
        downCapture3Y: {
          value: 0.88,
          zScore: 0.4,
          weight: -0.10,
          weightedZScore: -0.04,
          reweightedContribution: -0.04,
          percentile: 60,
          coverage: 0.87,
          weightSource: 'resolved'
        }
      }
    }
  };

  const demoBenchmark = {
    ticker: 'SPY',
    name: 'S&P 500 ETF',
    fund: {
      ytd_return: 0.082,
      one_year_return: 0.120,
      three_year_return: 0.085,
      sharpe_ratio: 1.20,
      standard_deviation_3y: 0.16,
      up_capture_ratio: 0.98,
      down_capture_ratio: 0.95
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ marginBottom: '20px', color: '#1F2937' }}>
        Score Analysis Components Demo
      </h1>
      
      <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#F0F9FF', borderRadius: '8px', border: '1px solid #BAE6FD' }}>
        <h3 style={{ margin: '0 0 8px 0', color: '#0C4A6E' }}>Demo Data</h3>
        <p style={{ margin: 0, color: '#0C4A6E', fontSize: '14px' }}>
          This demo shows the new Score Analysis components using mock data for VTSAX (Vanguard Total Stock Market Index Fund).
          The fund has a score of 78.5, which falls into the "Exceptional" category.
        </p>
      </div>

      <ScoreAnalysisSection 
        fund={demoFund} 
        benchmark={demoBenchmark} 
        funds={[]}
      />
    </div>
  );
};

export default ScoreAnalysisDemo; 