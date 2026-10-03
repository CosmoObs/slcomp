import React, { useState, useEffect } from 'react';
import { Drawer, Box, IconButton, Typography, Divider, Slider, ButtonBase, Chip, Stack, Button, Collapse } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';

export interface NumericFilterConfig {
  key: string;
  label: string;
}

export interface FiltersState {
  jnameSearch: string;
  references: string[]; // active references
  numeric: Record<string, [number, number] | null>; // key -> [min,max]
}

interface Props {
  open: boolean;
  onClose: () => void;
  allReferences: string[];
  numericFields: readonly NumericFilterConfig[];
  domain: Record<string, { min: number; max: number }>; // key -> domain
  value: FiltersState;
  onChange: (v: FiltersState) => void;
  onReset: () => void;
  totalCount: number;
  filteredCount: number;
}

const pct = (min: number, max: number) => `${min} – ${max}`;

export const FiltersDrawer: React.FC<Props> = ({ open, onClose, allReferences, numericFields, domain, value, onChange, onReset, totalCount, filteredCount }) => {
  // Local slider state (for smooth dragging without triggering expensive filtering each step)
  const [localNumeric, setLocalNumeric] = useState<Record<string,[number,number]>>({});
  const [refsCollapsed, setRefsCollapsed] = useState(true);

  // Initialize local slider ranges when domain changes or filters reset
  useEffect(()=> {
    const init: Record<string,[number,number]> = {};
    numericFields.forEach(f=> {
      const dom = domain[f.key];
      if(dom) init[f.key] = value.numeric[f.key] || [dom.min, dom.max];
    });
    setLocalNumeric(init);
  }, [domain, numericFields, value.numeric]);

  const toggleReference = (ref: string) => {
    const active = new Set(value.references);
    if(active.has(ref)) active.delete(ref); else active.add(ref);
    onChange({ ...value, references: Array.from(active) });
  };

  const updateNumericDrag = (key: string, range: number[]) => {
    setLocalNumeric(prev => ({ ...prev, [key]: [range[0], range[1]] }));
  };
  const commitNumeric = (key: string) => {
    const r = localNumeric[key];
    onChange({ ...value, numeric: { ...value.numeric, [key]: [r[0], r[1]] } });
  };

  const clearNumeric = (key: string) => {
    onChange({ ...value, numeric: { ...value.numeric, [key]: null } });
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 320, md: 360 },
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Box sx={{ p:2, pb:1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6">Refine results</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close filters"><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb:1 }}>{filteredCount.toLocaleString()} of {totalCount.toLocaleString()} objects</Typography>
        <ButtonBase onClick={() => setRefsCollapsed(c => !c)} aria-expanded={!refsCollapsed} aria-controls="reference-filters" sx={{ width: '100%', display: 'flex', justifyContent: 'space-between', py: 1.5, mt: 1 }}>
          <Typography variant="subtitle2">Reference catalogs</Typography>
          {refsCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
        </ButtonBase>
        <Collapse id="reference-filters" in={!refsCollapsed} timeout="auto" unmountOnExit>
          <Box sx={{ maxHeight:220, overflowY:'auto', pr:0.5, mb:2, border:'1px solid rgba(255,255,255,0.08)', borderRadius:1, p:1, background:'rgba(255,255,255,0.04)' }}>
            <Stack direction="row" flexWrap="wrap" gap={0.5}>
              {allReferences.map(r => {
                const active = value.references.includes(r);
                return <Chip key={r} label={r} size="small" color={active? 'primary':'default'} variant={active? 'filled':'outlined'} onClick={()=> toggleReference(r)} />;
              })}
            </Stack>
          </Box>
        </Collapse>
        <Divider sx={{ mb: 2, opacity:0.3 }} />
      </Box>
      <Box sx={{ flex:1, overflowY:'auto', px:2, pb:2 }}>
        <Stack spacing={2} sx={{ pr: 1 }}>
        {numericFields.map(f => {
          const dom = domain[f.key];
          if(!dom) return null;
            const current = localNumeric[f.key] || [dom.min, dom.max];
            const isActive = value.numeric[f.key] != null;
            return (
              <Box key={f.key}>
                <Box display="flex" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" sx={{ fontWeight:600, letterSpacing:0.4 }}>{f.label}</Typography>
                  {isActive && <Button size="small" onClick={()=> clearNumeric(f.key)} sx={{ fontSize:10, minWidth: 'auto', p:0.5, lineHeight:1 }}>reset</Button>}
                </Box>
                <Slider
                  size="small"
                  value={current}
                  min={dom.min}
                  max={dom.max}
                  onChange={(_, val)=> updateNumericDrag(f.key, val as number[])}
                  onChangeCommitted={()=> commitNumeric(f.key)}
                  getAriaLabel={() => f.label}
                  valueLabelDisplay="auto"
                  sx={{ mt: 1 }}
                />
                <Typography variant="caption" color="text.secondary">{pct(current[0], current[1])}</Typography>
              </Box>
            );
        })}
        </Stack>
      </Box>
      <Divider sx={{ mx:2, my:1, opacity:0.3 }} />
      <Box display="flex" gap={1} sx={{ p:2, pt:1 }}>
        <Button fullWidth size="small" variant="outlined" onClick={onReset}>Reset filters</Button>
        <Button fullWidth size="small" variant="contained" onClick={onClose}>Show results</Button>
      </Box>
    </Drawer>
  );
};
