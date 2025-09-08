import React, { useState, useEffect } from 'react';
import { Drawer, Box, IconButton, Typography, Divider, Slider, TextField, Chip, Stack, Button, Collapse } from '@mui/material';
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
  numericFields: NumericFilterConfig[];
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

  // Debounced JNAME search (user stops typing 300ms)
  const [searchDraft, setSearchDraft] = useState(value.jnameSearch);
  useEffect(()=> setSearchDraft(value.jnameSearch), [value.jnameSearch]);
  useEffect(()=> {
    const t = setTimeout(()=> {
      if(searchDraft !== value.jnameSearch){
        onChange({ ...value, jnameSearch: searchDraft });
      }
    }, 300);
    return ()=> clearTimeout(t);
  }, [searchDraft, value, onChange]);
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
      anchor="left" 
      open={open} 
      onClose={onClose} 
      PaperProps={{ 
        sx: ({ breakpoints }) => ({ 
          width: { xs: '100%', sm: 320, md: 360 }, 
          maxWidth: '100%', 
          background: 'linear-gradient(180deg,#0d1820,#0a141a)', 
          display:'flex', 
          flexDirection:'column',
          borderRight: '1px solid rgba(255,255,255,0.08)'
        }) 
      }}
    >
      <Box sx={{ p:2, pb:1 }}>
        <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <Typography variant="h6" sx={{ fontSize: 16, fontWeight: 600 }}>Filters</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb:1 }}>Showing {filteredCount} / {totalCount}</Typography>
        <TextField
          label="Search JNAME"
          size="small"
          fullWidth
            value={searchDraft}
            onChange={e=> setSearchDraft(e.target.value)}
            sx={{ mb: 2 }}
        />
        <Box display="flex" alignItems="center" justifyContent="space-between" sx={{ cursor:'pointer', mb:1 }} onClick={()=> setRefsCollapsed(c=> !c)}>
          <Typography variant="subtitle2">Reference Catalogs</Typography>
          <IconButton size="small" sx={{ ml:1 }}>
            {refsCollapsed ? <ExpandMoreIcon fontSize="small" /> : <ExpandLessIcon fontSize="small" />}
          </IconButton>
        </Box>
        <Collapse in={!refsCollapsed} timeout="auto" unmountOnExit>
          <Box sx={{ maxHeight:500, overflowY:'auto', pr:0.5, mb:2, border:'1px solid rgba(255,255,255,0.08)', borderRadius:1, p:1, background:'rgba(255,255,255,0.04)' }}>
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
            const applied = value.numeric[f.key] || [dom.min, dom.max];
            const isActive = value.numeric[f.key] != null && (applied[0] !== dom.min || applied[1] !== dom.max);
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
        <Button fullWidth size="small" variant="outlined" onClick={onReset}>Reset</Button>
        <Button fullWidth size="small" variant="contained" onClick={onClose}>Close</Button>
      </Box>
    </Drawer>
  );
};
