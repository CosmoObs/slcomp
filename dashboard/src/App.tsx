import React, { useMemo, useState, lazy, Suspense, useCallback } from 'react';
import { AppBar, Box, Container, Tab, Tabs, Toolbar, Typography, Paper, IconButton, Tooltip, Button, CircularProgress } from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import { useQuery } from '@tanstack/react-query';
import { loadDatabase, loadConsolidated, loadDictionary, loadCutouts } from './api';
const DataTables = lazy(()=> import('./components/DataTables').then(m => ({ default: m.DataTables })));
const CutoutGrid = lazy(()=> import('./components/CutoutGrid').then(m => ({ default: m.CutoutGrid })));
import { FiltersDrawer, FiltersState } from './components/FiltersDrawer';
import { ObjectsTable } from './components/ObjectsTable';
import { SkyMap } from './components/SkyMap';
import { useDebounce } from './hooks/useDebounce';
import type { CutoutRecord } from './types';

interface SkyMapObject {
  JNAME: string;
  RA?: number | null;
  DEC?: number | null;
  z_L?: number | null;
  z_S?: number | null;
  [key: string]: unknown;
}

function tabProps(index: number) {
  return { id: `tab-${index}`, 'aria-controls': `tabpanel-${index}` };
}

const App: React.FC = () => {
  const { data: database = [], isLoading: dbLoading, error: dbError } = useQuery({ queryKey: ['db'], queryFn: loadDatabase });
  const { data: consolidated = [], isLoading: consLoading, error: consError } = useQuery({ queryKey: ['cons'], queryFn: loadConsolidated });
  const { data: dictionary = {} as Record<string, unknown>, isLoading: dictLoading, error: dictError } = useQuery({ queryKey: ['dict'], queryFn: loadDictionary });
  const { data: cutouts = [], isLoading: cutoutsLoading, error: cutoutsError } = useQuery({ queryKey: ['cutouts'], queryFn: loadCutouts });

  const references = useMemo(()=> Object.keys(dictionary), [dictionary]);
  const [jname, setJName] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const initialFilters: FiltersState = useMemo(() => ({ 
    jnameSearch: '', 
    references: [], 
    numeric: {} 
  }), []);
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [tab, setTab] = useState(0);
  
  // Derive numeric domains for selected fields
  const numericFields = useMemo(() => [
    { key: 'RA', label: 'RA' },
    { key: 'DEC', label: 'DEC' },
    { key: 'z_L', label: 'z_L' },
    { key: 'z_S', label: 'z_S' }
  ], []);

  const domain = useMemo(()=>{
    const acc: Record<string,{min:number;max:number}> = {};
    numericFields.forEach(f=>{
      const vals: number[] = [];
      for(const r of database){
        if(!r) continue;
        let v: unknown = r[f.key];
        if(typeof v === 'string'){ const parsed = parseFloat(v); if(!isNaN(parsed)) v = parsed; }
        if(typeof v === 'number' && !isNaN(v)) vals.push(v);
      }
      if(vals.length){ acc[f.key] = { min: Math.min(...vals), max: Math.max(...vals) }; }
    });
    return acc;
  }, [database, numericFields]);

  // Precompute mapping: JNAME -> set of references (for fast filtering)
  const jnameToRefs = useMemo(()=> {
    const map: Record<string, Set<string>> = {};
    for(const ref of references){
      const entry = dictionary[ref] as { JNAME?: string[] };
      if(!entry || !Array.isArray(entry.JNAME)) continue;
      for(const jn of entry.JNAME){
        (map[jn] ||= new Set()).add(ref);
      }
    }
    return map;
  }, [references, dictionary]);

  // Unique base objects (collapse duplicates by JNAME, keep first numeric values encountered)
  const baseObjects = useMemo(()=> {
    const toNum = (x: unknown): number | null => {
      if(typeof x === 'number' && !isNaN(x)) return x;
      if(typeof x === 'string'){
        const v = parseFloat(x.trim());
        return isNaN(v) ? null : v;
      }
      return null;
    };
    const seen: Record<string, SkyMapObject> = {};
    for(const r of database){
      if(!r || !r.JNAME) continue;
      const RA = toNum(r.RA);
      const DEC = toNum(r.DEC);
      const z_L = toNum(r.z_L);
      const z_S = toNum(r.z_S);
      if(!seen[r.JNAME]){
        seen[r.JNAME] = { JNAME: r.JNAME, RA, DEC, z_L, z_S };
      } else {
        const tgt = seen[r.JNAME];
        if(tgt.RA == null && RA != null) tgt.RA = RA;
        if(tgt.DEC == null && DEC != null) tgt.DEC = DEC;
        if(tgt.z_L == null && z_L != null) tgt.z_L = z_L;
        if(tgt.z_S == null && z_S != null) tgt.z_S = z_S;
      }
    }
    return Object.values(seen);
  }, [database]);

  // Numeric filters keys to iterate quickly
  const activeNumericKeys = useMemo(()=> Object.entries(filters.numeric).filter(([_,v])=> !!v).map(([k])=> k), [filters.numeric]);

  // Debounce search text to avoid excessive filtering
  const debouncedSearch = useDebounce(filters.jnameSearch, 300);

  const filteredObjects = useMemo(()=> {
    if(!baseObjects.length) return [];
    const search = debouncedSearch.trim().toLowerCase();
    const useRefs = filters.references.length > 0;
    const refsSet = useRefs ? new Set(filters.references) : null;
    return baseObjects.filter((r: SkyMapObject)=> {
      if(!r || !r.JNAME) return false;
      if(search && !String(r.JNAME).toLowerCase().includes(search)) return false;
      if(useRefs){
        const rs = jnameToRefs[String(r.JNAME)];
        if(!rs) return false;
        let ok = false;
        for(const ref of rs){ if(refsSet!.has(ref)){ ok = true; break; } }
        if(!ok) return false;
      }
      if(activeNumericKeys.length){
        for(const k of activeNumericKeys){
          const range = filters.numeric[k]!;
          const val = r[k] as number;
          if(typeof val !== 'number') return false;
          if(val < range[0] || val > range[1]) return false;
        }
      }
      return true;
    });
  }, [baseObjects, debouncedSearch, filters.references, filters.numeric, jnameToRefs, activeNumericKeys]);

  // Selected object dependent data
  const filteredDb = useMemo(()=> database.filter(r=> r.JNAME === jname), [database, jname]);
  const filteredCons = useMemo(()=> consolidated.filter(r=> r.JNAME === jname), [consolidated, jname]);
  const filteredCutouts = useMemo(()=> cutouts.filter(c=> c.JNAME === jname), [cutouts, jname]);
  const surveys = useMemo(()=> Array.from(new Set(filteredCutouts.map(c=> String(c.survey)))).sort(), [filteredCutouts]);

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
  }, [initialFilters]);

  const handleDrawerToggle = useCallback(() => {
    setDrawerOpen(prev => !prev);
  }, []);

  const handleJNameSelect = useCallback((jname: string) => {
    setJName(jname);
  }, []);

  const handleJNameClear = useCallback(() => {
    setJName('');
  }, []);

  const handleTabChange = useCallback((event: unknown, value: number) => {
    setTab(value);
  }, []);

  const allReferences = useMemo(()=> references.sort(), [references]);

  const anyLoading = dbLoading || consLoading || dictLoading || cutoutsLoading;
  const anyError = dbError || consError || dictError || cutoutsError;

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar>
          <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>The LaStBeRu Explorer</Typography>
          <Box flexGrow={1} />
          <Tooltip title="Filters">
            <IconButton color="primary" onClick={handleDrawerToggle} size="small"><FilterAltIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Reset Filters">
            <span>
              <IconButton color="inherit" onClick={resetFilters} size="small" disabled={filters === initialFilters}><ClearAllIcon /></IconButton>
            </span>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {anyLoading && (
          <Paper sx={{ p:6, textAlign:'center', mb:3, background:'linear-gradient(135deg,#102028,#0c161c)' }}>
            <CircularProgress size={40} sx={{ mb:2 }} />
            <Typography variant="body2" color="text.secondary">Loading data...</Typography>
          </Paper>
        )}
        {anyError && (
          <Paper sx={{ p:4, mb:3, background:'linear-gradient(135deg,#281010,#1c0c0c)', border:'1px solid #552' }}>
            <Typography variant="h6" gutterBottom>Error loading data</Typography>
            <Typography variant="body2" color="text.secondary">{String(anyError)}</Typography>
          </Paper>
        )}
        <Paper sx={{ p: 2, mb: 3, background: 'linear-gradient(135deg,#112029,#0d151b)' }}>
          <Box display="flex" gap={2} alignItems="stretch" sx={{ height: 360 }}>
            <Box sx={{ flex:'0 0 260px', display:'flex', flexDirection:'column' }}>
              <Box sx={{ flex:1, minHeight:0 }}>
                <ObjectsTable objects={filteredObjects} onSelect={handleJNameSelect} selected={jname} fullHeight />
              </Box>
            </Box>
            <Box flex={1} minWidth={0}>
              <SkyMap objects={filteredObjects} selected={jname} onSelect={handleJNameSelect} height={360} />
            </Box>
          </Box>
          {jname && <Box sx={{ mt:1, textAlign:'left' }}><Button size="small" onClick={handleJNameClear}>Clear selection</Button></Box>}
        </Paper>
        {jname ? (
          <Paper sx={{ background: 'linear-gradient(145deg,#14232c,#101a21)', p: 2 }}>
            <Tabs value={tab} onChange={handleTabChange} textColor="primary" indicatorColor="primary" variant="scrollable">
              <Tab label="Data" {...tabProps(0)} />
              <Tab label="Cutouts" {...tabProps(1)} />
            </Tabs>
            <Box mt={3}>
              <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading module...</Typography>}>
                {tab === 0 && (
                  <DataTables database={filteredDb} consolidated={filteredCons} />
                )}
                {tab === 1 && (
                  <Box>
                    {surveys.map(s => {
                      const sortBands = (a: CutoutRecord, b: CutoutRecord) => {
                        const al = String(a.band).toLowerCase();
                        const bl = String(b.band).toLowerCase();
                        const rank = (x: string) => x === 'lsb' ? 0 : x === 'trilogy' ? 1 : 2;
                        const ra = rank(al); const rb = rank(bl);
                        if(ra !== rb) return ra - rb;
                        return al.localeCompare(bl);
                      };
                      const cutoutsBySurvey = filteredCutouts.filter(c=> c.survey === s).sort(sortBands);
                      return <CutoutGrid key={s} survey={s} cutouts={cutoutsBySurvey} />;
                    })}
                  </Box>
                )}
              </Suspense>
            </Box>
          </Paper>
        ) : (
          <Paper sx={{ p:4, textAlign:'center', background: 'linear-gradient(145deg,#14232c,#101a21)' }}>
            <Typography variant="h5" gutterBottom>Select an object</Typography>
            <Typography variant="body1" color="text.secondary">Use the panel for filters to refine your search and click on a JNAME in the table.</Typography>
          </Paper>
        )}
      </Container>
      <FiltersDrawer
        open={drawerOpen}
        onClose={()=> setDrawerOpen(false)}
        allReferences={allReferences}
        numericFields={numericFields}
        domain={domain}
        value={filters}
        onChange={setFilters}
        onReset={resetFilters}
        totalCount={database.length}
        filteredCount={filteredObjects.length}
      />
    </Box>
  );
};

export default App;
