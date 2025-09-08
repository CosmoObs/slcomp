import React, { useEffect, useState, memo } from 'react';
import { Typography, Box, Collapse } from '@mui/material';

interface PerformanceStats {
  renderTime: number;
  dataLoadTime: number;
  filteredCount: number;
  totalCount: number;
  memoryUsage?: number;
}

interface Props {
  stats: PerformanceStats;
  show?: boolean;
}

export const PerformanceMonitor: React.FC<Props> = memo(({ stats, show = false }) => {
  const [expanded, setExpanded] = useState(false);

  // Show performance stats in development mode
  const isDev = import.meta.env.DEV;

  useEffect(() => {
    // Log performance stats to console in dev mode
    if (isDev) {
      console.log('Performance Stats:', stats);
    }
  }, [stats, isDev]);

  if (!isDev && !show) return null;

  return (
    <Box sx={{ position: 'fixed', bottom: 8, left: 8, zIndex: 1000 }}>
      <Box
        sx={{
          background: 'rgba(0,0,0,0.8)',
          color: 'white',
          p: 1,
          borderRadius: 1,
          fontSize: '0.75rem',
          cursor: 'pointer',
          minWidth: 120
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <Typography variant="caption" sx={{ fontWeight: 'bold' }}>
          Performance {expanded ? '▼' : '▶'}
        </Typography>
        <Collapse in={expanded}>
          <Box sx={{ mt: 1, fontSize: '0.7rem', lineHeight: 1.2 }}>
            <div>Render: {stats.renderTime.toFixed(1)}ms</div>
            <div>Data Load: {stats.dataLoadTime.toFixed(1)}ms</div>
            <div>Filtered: {stats.filteredCount.toLocaleString()}</div>
            <div>Total: {stats.totalCount.toLocaleString()}</div>
            {stats.memoryUsage && (
              <div>Memory: {(stats.memoryUsage / 1024 / 1024).toFixed(1)}MB</div>
            )}
          </Box>
        </Collapse>
      </Box>
    </Box>
  );
});

PerformanceMonitor.displayName = 'PerformanceMonitor';

// Hook to measure performance
export const usePerformanceStats = () => {
  const [stats, setStats] = useState<PerformanceStats>({
    renderTime: 0,
    dataLoadTime: 0,
    filteredCount: 0,
    totalCount: 0
  });

  const updateStats = (newStats: Partial<PerformanceStats>) => {
    setStats(prev => ({ ...prev, ...newStats }));
  };

  const measureRenderTime = (callback: () => void) => {
    const start = performance.now();
    callback();
    const end = performance.now();
    updateStats({ renderTime: end - start });
  };

  const getMemoryUsage = () => {
    if ('memory' in performance) {
      return (performance as any).memory.usedJSHeapSize;
    }
    return undefined;
  };

  useEffect(() => {
    const interval = setInterval(() => {
      updateStats({ memoryUsage: getMemoryUsage() });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return { stats, updateStats, measureRenderTime };
};
