import React, { useMemo, useCallback, memo } from 'react';
import { Box, ButtonBase, Paper, Typography, useMediaQuery, useTheme } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
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

const ROW_HEIGHT = 64;
const coordinate = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(4)}°` : '—';

export const ObjectsTable: React.FC<Props> = memo(({ objects, onSelect, selected, height = 540 }) => {
  const items = useMemo(() => objects.filter(o => !!o?.JNAME), [objects]);
  const selectedIndex = useMemo(() => items.findIndex(o => o.JNAME === selected), [items, selected]);
  const isDesktop = useMediaQuery(useTheme().breakpoints.up('md'));
  const panelHeight = isDesktop ? height : Math.min(320, 68 + (items.length || 2) * ROW_HEIGHT);
  const listHeight = panelHeight - 68;

  const renderItem = useCallback((item: SkyObject) => {
    const isSelected = item.JNAME === selected;
    return (
      <ButtonBase
        onClick={() => onSelect(item.JNAME)}
        aria-label={`View object ${item.JNAME}`}
        aria-pressed={isSelected}
        sx={{
          height: ROW_HEIGHT, width: '100%', justifyContent: 'space-between', px: 2,
          textAlign: 'left', borderBottom: '1px solid', borderBottomColor: 'divider',
          borderLeft: '2px solid', borderLeftColor: isSelected ? 'primary.main' : 'transparent',
          bgcolor: isSelected ? 'action.selected' : 'transparent',
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-focusVisible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: -3 }
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, color: isSelected ? 'primary.main' : 'text.primary' }}>{item.JNAME}</Typography>
          <Typography variant="caption" color="text.secondary">RA {coordinate(item.RA)} · DEC {coordinate(item.DEC)}</Typography>
        </Box>
        <ChevronRightIcon sx={{ fontSize: 18, color: isSelected ? 'primary.main' : 'text.secondary', ml: 1 }} />
      </ButtonBase>
    );
  }, [onSelect, selected]);

  const itemKey = useCallback((item: SkyObject) => item.JNAME, []);

  return (
    <Paper component="section" aria-label="Catalog results" sx={{ overflow: 'hidden', height: panelHeight, borderRight: { md: '1px solid #2b333e' }, borderBottom: { xs: '1px solid #2b333e', md: 0 }, borderRadius: 0, pr: { md: 2 } }}>
      <Box sx={{ height: 68, px: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Results</Typography>
          <Typography variant="caption" color="text.secondary">Select an object to explore</Typography>
        </Box>

      </Box>
      {items.length === 0 ? (
        <Box sx={{ p: 3 }}>
          <Typography variant="body2" sx={{ mb: 1 }}>No matching objects</Typography>
          <Typography variant="body2" color="text.secondary">Try another JNAME or adjust your filters.</Typography>
        </Box>
      ) : (
        <VirtualizedList items={items} renderItem={renderItem} itemHeight={ROW_HEIGHT} containerHeight={listHeight} scrollToIndex={selectedIndex} itemKey={itemKey} />
      )}
    </Paper>
  );
});

ObjectsTable.displayName = 'ObjectsTable';
