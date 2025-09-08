import React, { memo, useMemo } from 'react';

interface VirtualizedListProps<T = unknown> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export const VirtualizedList = memo(<T,>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5
}: VirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = React.useState(0);

  const visibleIndices = useMemo(() => {
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + Math.ceil(containerHeight / itemHeight),
      items.length - 1
    );

    const start = Math.max(0, startIndex - overscan);
    const end = Math.min(items.length - 1, endIndex + overscan);

    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);

  const visibleItems = useMemo(() => {
    const { start, end } = visibleIndices;
    return items.slice(start, end + 1).map((item, index) => ({
      item,
      index: start + index
    }));
  }, [items, visibleIndices]);

  const handleScroll = React.useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const totalHeight = items.length * itemHeight;

  if (items.length < 20) {
    // Para listas pequenas, não usar virtualização
    return (
      <div style={{ maxHeight: containerHeight, overflowY: 'auto' }}>
        {items.map((item, index) => renderItem(item, index))}
      </div>
    );
  }

  return (
    <div
      style={{
        height: containerHeight,
        overflowY: 'auto',
        position: 'relative'
      }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${visibleIndices.start * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {visibleItems.map(({ item, index }) =>
            renderItem(item, index)
          )}
        </div>
      </div>
    </div>
  );
});
