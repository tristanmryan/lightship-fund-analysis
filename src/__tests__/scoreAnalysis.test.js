// src/__tests__/scoreAnalysis.test.js
import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ScoreBreakdownChart from '../components/Dashboard/ScoreBreakdownChart';
import MetricExplanationPanel from '../components/Dashboard/MetricExplanationPanel';
import ScoreAnalysisSection from '../components/Dashboard/ScoreAnalysisSection';

// Mock fund data with scores
const mockFund = {
  ticker: 'VTSAX',
  Symbol: 'VTSAX',
  scores: {
    final: 75.2,
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
      }
    }
  }
};

const mockBenchmark = {
  ticker: 'SPY',
  name: 'S&P 500 ETF',
  fund: {
    ytd_return: 0.082,
    one_year_return: 0.120,
    three_year_return: 0.085,
    sharpe_ratio: 1.20,
    standard_deviation_3y: 0.16
  }
};

describe('Score Analysis Components', () => {
  describe('ScoreBreakdownChart', () => {
    test('renders chart with fund data', () => {
      render(<ScoreBreakdownChart fund={mockFund} />);
      expect(screen.getByText('Score Breakdown Analysis')).toBeInTheDocument();
      expect(screen.getByText('VTSAX score: 75.2')).toBeInTheDocument();
    });

    test('renders chart type selector buttons', () => {
      render(<ScoreBreakdownChart fund={mockFund} />);
      expect(screen.getByText('Horizontal Bars')).toBeInTheDocument();
      expect(screen.getByText('Waterfall')).toBeInTheDocument();
      expect(screen.getByText('Radar')).toBeInTheDocument();
    });

    test('shows no data message when fund has no scores', () => {
      const fundWithoutScores = { ticker: 'TEST' };
      render(<ScoreBreakdownChart fund={fundWithoutScores} />);
      expect(screen.getByText('No score breakdown available for this fund')).toBeInTheDocument();
    });
  });

  describe('MetricExplanationPanel', () => {
    test('renders metric explanations panel', () => {
      render(<MetricExplanationPanel fund={mockFund} benchmark={mockBenchmark} />);
      expect(screen.getByText('Metric Analysis & Explanations')).toBeInTheDocument();
      expect(screen.getByText('Detailed breakdown of how each metric contributes to the overall score')).toBeInTheDocument();
    });

    test('shows benchmark comparison when available', () => {
      render(<MetricExplanationPanel fund={mockFund} benchmark={mockBenchmark} />);
      expect(screen.getByText('vs SPY')).toBeInTheDocument();
    });

    test('displays metric data correctly', () => {
      render(<MetricExplanationPanel fund={mockFund} benchmark={mockBenchmark} />);
      expect(screen.getByText('YTD Return')).toBeInTheDocument();
      expect(screen.getByText('1-Year Return')).toBeInTheDocument();
      expect(screen.getByText('3-Year Return')).toBeInTheDocument();
    });

    test('shows no data message when fund has no scores', () => {
      const fundWithoutScores = { ticker: 'TEST' };
      render(<MetricExplanationPanel fund={fundWithoutScores} />);
      expect(screen.getByText('No metric breakdown available for this fund')).toBeInTheDocument();
    });
  });

  describe('ScoreAnalysisSection', () => {
    test('renders score analysis section', () => {
      render(<ScoreAnalysisSection fund={mockFund} benchmark={mockBenchmark} />);
      expect(screen.getByText('Score Analysis Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Professional analysis tools for client presentations')).toBeInTheDocument();
    });

    test('displays score overview correctly', () => {
      render(<ScoreAnalysisSection fund={mockFund} benchmark={mockBenchmark} />);
      expect(screen.getByText('75.2')).toBeInTheDocument();
      expect(screen.getByText('Exceptional')).toBeInTheDocument();
      expect(screen.getByText('This fund ranks in the top 10% of its asset class')).toBeInTheDocument();
    });

    test('renders all three tabs', () => {
      render(<ScoreAnalysisSection fund={mockFund} benchmark={mockBenchmark} />);
      expect(screen.getByText('Score Breakdown Charts')).toBeInTheDocument();
      expect(screen.getByText('Detailed Explanations')).toBeInTheDocument();
      expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    });

    test('shows export and share buttons', () => {
      render(<ScoreAnalysisSection fund={mockFund} benchmark={mockBenchmark} />);
      expect(screen.getByText('Export')).toBeInTheDocument();
      expect(screen.getByText('Share')).toBeInTheDocument();
    });

    test('shows no data message when fund has no scores', () => {
      const fundWithoutScores = { ticker: 'TEST' };
      render(<ScoreAnalysisSection fund={fundWithoutScores} />);
      expect(screen.getByText('No Score Analysis Available')).toBeInTheDocument();
    });
  });
}); 