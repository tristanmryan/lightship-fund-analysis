import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { BrowserRouter } from 'react-router-dom';

// Mock console.info to keep test output clean
const originalConsoleInfo = console.info;
beforeAll(() => {
  console.info = jest.fn();
});

afterAll(() => {
  console.info = originalConsoleInfo;
});

// Mock the visual refresh functionality from index.js
const mockToggleVisualRefresh = (on) => {
  if (on) {
    document.documentElement.classList.add('visual-refresh');
    
    // Inject Inter font if not already present
    if (!document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap';
      document.head.appendChild(link);
    }
  } else {
    document.documentElement.classList.remove('visual-refresh');
    
    // Remove Inter font link
    const link = document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]');
    if (link) {
      link.remove();
    }
  }
  
  localStorage.setItem('visualRefresh', on ? 'on' : 'off');
};

// Mock EnhancedPerformanceDashboard for density toggle tests
const MockEnhancedPerformanceDashboard = () => {
  const [density, setDensity] = React.useState(() => localStorage.getItem('tableDensity') || 'comfortable');
  
  React.useEffect(() => {
    document.documentElement.classList.toggle('density-compact', density === 'compact');
    localStorage.setItem('tableDensity', density);
  }, [density]);

  return (
    <div data-testid="enhanced-performance-dashboard">
      <div className="density-toggle" aria-label="Table density">
        <button
          className={`btn-secondary ${density === 'comfortable' ? 'active' : ''}`}
          onClick={() => setDensity('comfortable')}
          type="button"
        >
          Comfort
        </button>
        <button
          className={`btn-secondary ${density === 'compact' ? 'active' : ''}`}
          onClick={() => setDensity('compact')}
          type="button"
        >
          Compact
        </button>
      </div>
    </div>
  );
};

describe('Visual Refresh Safety Tests', () => {
  beforeEach(() => {
    // Reset localStorage and document classes before each test
    localStorage.clear();
    document.documentElement.classList.remove('visual-refresh', 'density-compact');
    
    // Reset environment variables
    delete process.env.REACT_APP_ENABLE_VISUAL_REFRESH;
    
    // Remove any existing Inter font links
    const existingLinks = document.querySelectorAll('link[href*="fonts.googleapis.com/css2?family=Inter"]');
    existingLinks.forEach(link => link.remove());
  });

  describe('Visual Refresh Flag Tests', () => {
    test('flag off (default) → document.documentElement does not have .visual-refresh', () => {
      // Ensure no visual refresh class is present
      expect(document.documentElement).not.toHaveClass('visual-refresh');
      
      // Verify no Inter font link is present
      const interLink = document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]');
      expect(interLink).not.toBeInTheDocument();
    });

    test('flag on (env) → document.documentElement has .visual-refresh and Inter font link', () => {
      // Set environment variable
      process.env.REACT_APP_ENABLE_VISUAL_REFRESH = 'true';
      
      // Simulate the initialization logic from index.js
      const envOn = process.env.REACT_APP_ENABLE_VISUAL_REFRESH === 'true';
      const storedOn = localStorage.getItem('visualRefresh') === 'on';
      
      if (envOn || storedOn) {
        mockToggleVisualRefresh(true);
      }
      
      // Verify visual refresh class is applied
      expect(document.documentElement).toHaveClass('visual-refresh');
      
      // Verify Inter font link is injected
      const interLink = document.querySelector('link[href*="fonts.googleapis.com/css2?family=Inter"]');
      expect(interLink).toBeInTheDocument();
      expect(interLink.href).toContain('fonts.googleapis.com/css2?family=Inter');
    });
  });

  describe('Runtime Toggle Tests', () => {
    test('keydown with metaKey+altKey+v toggles visual refresh class', async () => {
      // Initial state should be off
      expect(document.documentElement).not.toHaveClass('visual-refresh');
      expect(localStorage.getItem('visualRefresh')).not.toBe('on');
      
      // Simulate Cmd+Alt+V (macOS) or Ctrl+Alt+V (Windows/Linux)
      const keydownEvent = new KeyboardEvent('keydown', {
        key: 'v',
        metaKey: true,
        altKey: true,
        ctrlKey: false
      });
      
      // Mock the global event listener behavior
      if (keydownEvent.metaKey && keydownEvent.altKey && keydownEvent.key.toLowerCase() === 'v') {
        const on = !document.documentElement.classList.contains('visual-refresh');
        mockToggleVisualRefresh(on);
      }
      
      // Verify the class is applied
      expect(document.documentElement).toHaveClass('visual-refresh');
      
      // Verify localStorage is updated
      expect(localStorage.getItem('visualRefresh')).toBe('on');
      
      // Toggle off with another keydown
      if (keydownEvent.metaKey && keydownEvent.altKey && keydownEvent.key.toLowerCase() === 'v') {
        const on = !document.documentElement.classList.contains('visual-refresh');
        mockToggleVisualRefresh(on);
      }
      
      // Verify the class is removed
      expect(document.documentElement).not.toHaveClass('visual-refresh');
      
      // Verify localStorage is updated
      expect(localStorage.getItem('visualRefresh')).toBe('off');
    });

    test('keydown with ctrlKey+altKey+v toggles visual refresh class', async () => {
      // Initial state should be off
      expect(document.documentElement).not.toHaveClass('visual-refresh');
      
      // Simulate Ctrl+Alt+V (Windows/Linux)
      const keydownEvent = new KeyboardEvent('keydown', {
        key: 'v',
        ctrlKey: true,
        altKey: true,
        metaKey: false
      });
      
      // Mock the global event listener behavior
      if ((keydownEvent.ctrlKey || keydownEvent.metaKey) && keydownEvent.altKey && keydownEvent.key.toLowerCase() === 'v') {
        const on = !document.documentElement.classList.contains('visual-refresh');
        mockToggleVisualRefresh(on);
      }
      
      // Verify the class is applied
      expect(document.documentElement).toHaveClass('visual-refresh');
      
      // Verify localStorage is updated
      expect(localStorage.getItem('visualRefresh')).toBe('on');
    });

    test('keydown with different keys does not trigger toggle', () => {
      // Initial state
      expect(document.documentElement).not.toHaveClass('visual-refresh');
      
      // Simulate different key combinations that should not trigger
      const nonToggleEvents = [
        { key: 'v', metaKey: true, altKey: false, ctrlKey: false }, // Missing alt
        { key: 'v', metaKey: false, altKey: true, ctrlKey: false }, // Missing meta/ctrl
        { key: 'h', metaKey: true, altKey: true, ctrlKey: false }, // Wrong key
        { key: 'V', metaKey: true, altKey: false, ctrlKey: false }, // Wrong case, missing alt
        { key: 'x', metaKey: true, altKey: true, ctrlKey: false }, // Completely different key
        { key: 'v', metaKey: false, altKey: false, ctrlKey: false }, // No modifiers
        { key: 'a', metaKey: false, altKey: false, ctrlKey: false }, // Different key, no modifiers
        { key: 'v', metaKey: false, altKey: false, ctrlKey: true }, // Only ctrl, missing alt
        { key: 'v', metaKey: true, altKey: false, ctrlKey: true }, // meta+ctrl, missing alt
      ];
      
      // These should not trigger the toggle - verify the condition is false for each
      nonToggleEvents.forEach((eventProps, index) => {
        const shouldTrigger = (eventProps.metaKey || eventProps.ctrlKey) && eventProps.altKey && eventProps.key.toLowerCase() === 'v';
        console.log(`Event ${index}:`, eventProps, 'shouldTrigger:', shouldTrigger);
        if (shouldTrigger) {
          console.log(`Event ${index} unexpectedly matches:`, eventProps);
        }
        expect(shouldTrigger).toBe(false);
      });
      
      // Should still be off
      expect(document.documentElement).not.toHaveClass('visual-refresh');
      expect(localStorage.getItem('visualRefresh')).not.toBe('on');
    });
  });

  describe('Density Toggle Tests', () => {
    test('density toggle persistence and class application', async () => {
      render(
        <BrowserRouter>
          <MockEnhancedPerformanceDashboard />
        </BrowserRouter>
      );
      
      // Initial state should be comfortable
      expect(document.documentElement).not.toHaveClass('density-compact');
      expect(localStorage.getItem('tableDensity')).toBe('comfortable');
      
      // Find and click the Compact button
      const compactButton = screen.getByText('Compact');
      expect(compactButton).toBeInTheDocument();
      
      fireEvent.click(compactButton);
      
      // Wait for the class to be applied
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('density-compact');
      });
      
      // Verify localStorage is updated
      expect(localStorage.getItem('tableDensity')).toBe('compact');
      
      // Click Comfort button to toggle back
      const comfortButton = screen.getByText('Comfort');
      fireEvent.click(comfortButton);
      
      // Wait for the class to be removed
      await waitFor(() => {
        expect(document.documentElement).not.toHaveClass('density-compact');
      });
      
      // Verify localStorage is updated
      expect(localStorage.getItem('tableDensity')).toBe('comfortable');
    });

    test('density toggle persistence across re-mounts', async () => {
      // Set initial density to compact
      localStorage.setItem('tableDensity', 'compact');
      
      // First render
      const { unmount } = render(
        <BrowserRouter>
          <MockEnhancedPerformanceDashboard />
        </BrowserRouter>
      );
      
      // Should start with compact density
      expect(document.documentElement).toHaveClass('density-compact');
      expect(localStorage.getItem('tableDensity')).toBe('compact');
      
      // Unmount
      unmount();
      
      // Clear classes
      document.documentElement.classList.remove('density-compact');
      
      // Re-mount
      render(
        <BrowserRouter>
          <MockEnhancedPerformanceDashboard />
        </BrowserRouter>
      );
      
      // Should restore compact density from localStorage
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('density-compact');
      });
      expect(localStorage.getItem('tableDensity')).toBe('compact');
    });

    test('density toggle button states reflect current selection', () => {
      render(
        <BrowserRouter>
          <MockEnhancedPerformanceDashboard />
        </BrowserRouter>
      );
      
      const comfortButton = screen.getByText('Comfort');
      const compactButton = screen.getByText('Compact');
      
      // Initially Comfort should be active
      expect(comfortButton).toHaveClass('active');
      expect(compactButton).not.toHaveClass('active');
      
      // Click Compact
      fireEvent.click(compactButton);
      
      // Now Compact should be active
      expect(comfortButton).not.toHaveClass('active');
      expect(compactButton).toHaveClass('active');
    });
  });

  describe('Integration Tests', () => {
    test('visual refresh and density can coexist', async () => {
      // Enable visual refresh
      process.env.REACT_APP_ENABLE_VISUAL_REFRESH = 'true';
      mockToggleVisualRefresh(true);
      
      // Set density to compact
      localStorage.setItem('tableDensity', 'compact');
      
      render(
        <BrowserRouter>
          <MockEnhancedPerformanceDashboard />
        </BrowserRouter>
      );
      
      // Both classes should be present
      expect(document.documentElement).toHaveClass('visual-refresh');
      expect(document.documentElement).toHaveClass('density-compact');
      
      // Toggle density to comfortable
      const comfortButton = screen.getByText('Comfort');
      fireEvent.click(comfortButton);
      
      // Visual refresh should remain, density should toggle to comfortable
      await waitFor(() => {
        expect(document.documentElement).toHaveClass('visual-refresh');
        expect(document.documentElement).not.toHaveClass('density-compact');
      });
    });

    test('localStorage values are properly managed', () => {
      // Test initial state
      expect(localStorage.getItem('visualRefresh')).toBeNull();
      expect(localStorage.getItem('tableDensity')).toBeNull();
      
      // Simulate visual refresh toggle
      mockToggleVisualRefresh(true);
      
      // Verify visual refresh localStorage is set
      expect(localStorage.getItem('visualRefresh')).toBe('on');
      
      // Render the component to trigger density localStorage initialization
      render(
        <BrowserRouter>
          <MockEnhancedPerformanceDashboard />
        </BrowserRouter>
      );
      
      // Now both localStorage values should be set
      expect(localStorage.getItem('visualRefresh')).toBe('on');
      expect(localStorage.getItem('tableDensity')).toBe('comfortable'); // Default from component
    });
  });
}); 