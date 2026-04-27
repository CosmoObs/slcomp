import React, { useMemo, useCallback, memo } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { VirtualizedList } from './VirtualizedList';

interface SkyObject {
  JNAME: string;
  [key: string]: unknown;
}

interface Props {
  objects: SkyObject[];
  onSelect: (jname: string) => void;
  selected: string;
  height?: number;
}

const ROW_HEIGHT = 28;

export const ObjectsTable: React.FC<Props> = memo(({ objects, onSelect, selected, height = 360 }) => {
  // Pre-filter once. Items keep stable identity across renders via JNAME.
  const items = useMemo(() => objects.filter(o => !!o?.JNAME), [objects]);

  const selectedIndex = useMemo(() => {
    if (!selected) return -1;
    for (let i = 0; i < items.length; i++) if (items[i].JNAME === selected) return i;
    return -1;
  }, [items, selected]);

  // Reserve room for header + count line.
  const HEADER_RESERVED = 28;
  const listHeight = Math.max(80, height - HEADER_RESERVED);

  const renderItem = useCallback(
    (item: SkyObject, _idx: number) => {
      const isSel = item.JNAME === selected;
      return (
        <Box
          onClick={() => onSelect(item.JNAME)}
          sx={{
            height: ROW_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            px: 1,
            cursor: 'pointer',
            fontSize: 12,
            fontFamily: 'inherit',
            color: 'text.primary',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            background: isSel ? 'rgba(0,120,180,0.28)' : 'transparent',
            '&:hover': { background: isSel ? 'rgba(0,120,180,0.32)' : 'rgba(255,255,255,0.04)' },
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}
        >
          {item.JNAME}
        </Box>
      );
    },
    [onSelect, selected]
  );

  const itemKey = useCallback((it: SkyObject) => it.JNAME, []);

  return (
    <Paper sx={{ p: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Typography variant="caption" sx={{ pl: 1, fontWeight: 600, letterSpacing: 0.5, mb: 0.5 }}>
        Filtered Objects ({items.length})
      </Typography>
      <Box sx={{ flex: 1, minHeight: 0, border: '1px solid rgba(255,255,255,0.06)', borderRadius: 1, overflow: 'hidden', background: 'rgba(0,0,0,0.2)' }}>
        {items.length === 0 ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary">No objects.</Typography>
          </Box>
        ) : (
          <VirtualizedList
            items={items}
            renderItem={renderItem}
            itemHeight={ROW_HEIGHT}
            containerHeight={listHeight}
            scrollToIndex={selectedIndex}
            itemKey={itemKey}
          />
        )}
      </Box>
    </Paper>
  );
});

ObjectsTable.displayName = 'ObjectsTable';
