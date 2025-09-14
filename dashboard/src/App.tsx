import React, { useMemo, useState, lazy, Suspense, useCallback } from 'react';
import { AppBar, Box, Container, Tab, Tabs, Toolbar, Typography, Paper, IconButton, Tooltip, Button, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
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
  
  // Derive numeric domains for selected fields (memoized with cache)
  const numericFields = useMemo(() => [
    { key: 'RA', label: 'RA' },
    { key: 'DEC', label: 'DEC' },
    { key: 'z_L', label: 'z_L' },
    { key: 'z_S', label: 'z_S' }
  ], []);

  const domain = useMemo(()=>{
    if (!database.length) return {};
    
    const acc: Record<string,{min:number;max:number}> = {};
    numericFields.forEach(f=>{
      const vals: number[] = [];
      // Sample every 10th record for large datasets to speed up domain calculation
      const step = database.length > 10000 ? 10 : 1;
      for(let i = 0; i < database.length; i += step){
        const r = database[i];
        if(!r) continue;
        let v: unknown = r[f.key];
        if(typeof v === 'string'){ const parsed = parseFloat(v); if(!isNaN(parsed)) v = parsed; }
        if(typeof v === 'number' && !isNaN(v)) vals.push(v);
      }
      if(vals.length){ acc[f.key] = { min: Math.min(...vals), max: Math.max(...vals) }; }
    });
    return acc;
  }, [database, numericFields]);

  // Precompute mapping: JNAME -> set of references (for fast filtering) - optimized
  const jnameToRefs = useMemo(()=> {
    if (!references.length) return {};
    
    const map: Record<string, Set<string>> = {};
    for(const ref of references){
      const entry = dictionary[ref] as { JNAME?: string[] };
      if(!entry || !Array.isArray(entry.JNAME)) continue;
      for(const jn of entry.JNAME){
        if (!map[jn]) map[jn] = new Set();
        map[jn].add(ref);
      }
    }
    return map;
  }, [references, dictionary]);

  // Unique base objects (collapse duplicates by JNAME) - optimized with early returns
  const baseObjects = useMemo(()=> {
    if (!database.length) return [];
    
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
      if(!r?.JNAME) continue;
      
      if(!seen[r.JNAME]){
        const RA = toNum(r.RA);
        const DEC = toNum(r.DEC);
        const z_L = toNum(r.z_L);
        const z_S = toNum(r.z_S);
        seen[r.JNAME] = { JNAME: r.JNAME, RA, DEC, z_L, z_S };
      } else {
        // Only update null values to avoid unnecessary work
        const tgt = seen[r.JNAME];
        if(tgt.RA == null) tgt.RA = toNum(r.RA);
        if(tgt.DEC == null) tgt.DEC = toNum(r.DEC);
        if(tgt.z_L == null) tgt.z_L = toNum(r.z_L);
        if(tgt.z_S == null) tgt.z_S = toNum(r.z_S);
      }
    }
    return Object.values(seen);
  }, [database]);

  // Numeric filters keys to iterate quickly
  const activeNumericKeys = useMemo(()=> Object.entries(filters.numeric).filter(([_,v])=> !!v).map(([k])=> k), [filters.numeric]);

  // Debounce search text to avoid excessive filtering
  const debouncedSearch = useDebounce(filters.jnameSearch, 300);

  // Optimized filtering with early returns and better algorithms
  const filteredObjects = useMemo(()=> {
    if(!baseObjects.length) return [];
    
    const search = debouncedSearch.trim().toLowerCase();
    const useRefs = filters.references.length > 0;
    const refsSet = useRefs ? new Set(filters.references) : null;
    const hasNumericFilters = activeNumericKeys.length > 0;
    
    return baseObjects.filter((r: SkyMapObject)=> {
      if(!r?.JNAME) return false;
      
      // Text search first (cheapest filter)
      if(search && !String(r.JNAME).toLowerCase().includes(search)) return false;
      
      // Reference filter
      if(useRefs){
        const rs = jnameToRefs[String(r.JNAME)];
        if(!rs) return false;
        let hasMatchingRef = false;
        for(const ref of rs){ 
          if(refsSet!.has(ref)){ 
            hasMatchingRef = true; 
            break; 
          } 
        }
        if(!hasMatchingRef) return false;
      }
      
      // Numeric filters (most expensive, do last)
      if(hasNumericFilters){
        for(const k of activeNumericKeys){
          const range = filters.numeric[k]!;
          const val = r[k] as number;
          if(typeof val !== 'number' || val < range[0] || val > range[1]) return false;
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
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const panelHeight = isMdUp ? 360 : 300; // responsive height for map/table

  // Show loading state early to improve perceived performance
  if (anyLoading && !database.length) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar>
            <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>The LaStBeRu Explorer</Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Paper sx={{ p:6, textAlign:'center', mb:3, background:'linear-gradient(135deg,#102028,#0c161c)' }}>
            <CircularProgress size={40} sx={{ mb:2 }} />
            <Typography variant="body2" color="text.secondary">Loading astronomical data...</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
              This may take a moment for large datasets
            </Typography>
          </Paper>
        </Container>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="transparent" elevation={0}>
        <Toolbar>
          {/* Logo SLComp à esquerda */}
          <Box sx={{ display:'flex', alignItems:'center', mr:1 }}>
            <img src="https://raw.githubusercontent.com/CosmoObs/slcomp/refs/heads/main/.figures/slcomp.png" alt="SLComp Logo" style={{ height:32, width:80, marginRight:8, borderRadius:1, background:'#000000ff' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>The LaStBeRu Explorer</Typography>
          </Box>
          <Box flexGrow={1} />
          <Tooltip title="Filters">
            <IconButton color="primary" onClick={handleDrawerToggle} size="small"><FilterAltIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Reset Filters">
            <span>
              <IconButton color="inherit" onClick={resetFilters} size="small" disabled={filters === initialFilters}><ClearAllIcon /></IconButton>
            </span>
          </Tooltip>
          {/* Botão GitHub à direita */}
          <Box sx={{ ml:2 }}>
            <Tooltip title="slcomp Repository">
              <IconButton
                color="inherit"
                component="a"
                href="https://github.com/CosmoObs/slcomp"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                sx={{ p:0.0 }}
              >
                <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" style={{ height:28, width:28, borderRadius:'50%' }} />
              </IconButton>
            </Tooltip>
          </Box>
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
          <Box display="flex" gap={2} alignItems="stretch" 
               sx={{ flexDirection:{ xs:'column', md:'row' } }}>
            <Box 
              sx={{ 
                flex: { xs:'1 1 auto', md:'0 0 260px' }, 
                width:{ xs:'100%', md:260 }, 
                display:'flex', 
                flexDirection:'column', 
                minHeight:0, 
                height:{ md: panelHeight }
              }}
            >
              <Box sx={{ flex:1, minHeight:0 }}>
                <ObjectsTable 
                  objects={filteredObjects} 
                  onSelect={handleJNameSelect} 
                  selected={jname} 
                  fullHeight={isMdUp} 
                  height={panelHeight} 
                />
              </Box>
            </Box>
            <Box flex={1} minWidth={0} sx={{ height: panelHeight }}>
              <SkyMap 
                objects={filteredObjects} 
                selected={jname} 
                onSelect={handleJNameSelect} 
                height={panelHeight} 
              />
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
