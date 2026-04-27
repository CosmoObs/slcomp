import React, { memo, useMemo, useState, useCallback, useEffect, useRef } from 'react';

interface VirtualizedListProps<T = unknown> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
  scrollToIndex?: number;
  itemKey?: (item: T, index: number) => React.Key;
}

const VirtualizedListInner = <T,>({
  items,
  renderItem,
  itemHeight,
  containerHeight,
  overscan = 5,
  scrollToIndex,
  itemKey
}: VirtualizedListProps<T>) => {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

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

  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Bring scrollToIndex into view if outside the visible range. Stale indexes
  // (e.g. selection survived a list shrink) are silently ignored.
  useEffect(() => {
    if (scrollToIndex == null || scrollToIndex < 0 || scrollToIndex >= items.length) return;
    const el = containerRef.current;
    if (!el) return;
    const top = scrollToIndex * itemHeight;
    const bottom = top + itemHeight;
    const viewTop = el.scrollTop;
    const viewBottom = viewTop + containerHeight;
    if (top < viewTop) {
      el.scrollTop = top;
    } else if (bottom > viewBottom) {
      el.scrollTop = bottom - containerHeight;
    }
  }, [scrollToIndex, itemHeight, containerHeight, items.length]);

  const totalHeight = items.length * itemHeight;
  const { start, end } = visibleIndices;

  return (
    <div
      ref={containerRef}
      style={{ height: containerHeight, overflowY: 'auto', position: 'relative' }}
      onScroll={handleScroll}
    >
      <div style={{ height: totalHeight, position: 'relative' }}>
        <div
          style={{
            transform: `translateY(${start * itemHeight}px)`,
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0
          }}
        >
          {items.slice(start, end + 1).map((item, i) => {
            const idx = start + i;
            const key = itemKey ? itemKey(item, idx) : idx;
            return (
              <div key={key} style={{ height: itemHeight }}>
                {renderItem(item, idx)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export const VirtualizedList = memo(VirtualizedListInner) as typeof VirtualizedListInner;
