import React, { useMemo, useState, lazy, Suspense, useCallback } from 'react';
import { AppBar, Box, Container, Tab, Tabs, Toolbar, Typography, Paper, IconButton, Tooltip, Button, CircularProgress, useMediaQuery, useTheme } from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import { useQuery } from '@tanstack/react-query';
import { loadDatabase, loadConsolidated, loadDictionary, loadCutouts } from './api';
const DataTables = lazy(() => import('./components/DataTables').then(m => ({ default: m.DataTables })));
const CutoutGrid = lazy(() => import('./components/CutoutGrid').then(m => ({ default: m.CutoutGrid })));
import { FiltersDrawer, FiltersState } from './components/FiltersDrawer';
import { ObjectsTable } from './components/ObjectsTable';
import { SkyMap } from './components/SkyMap';
import { useDebounce } from './hooks/useDebounce';
import type { CutoutRecord, DataRecord, ConsolidatedRecord } from './types';

interface SkyMapObject {
  JNAME: string;
  RA?: number | null;
  DEC?: number | null;
  z_L?: number | null;
  z_S?: number | null;
  [key: string]: unknown;
}

const NUMERIC_FIELDS = [
  { key: 'RA', label: 'RA' },
  { key: 'DEC', label: 'DEC' },
  { key: 'z_L', label: 'z_L' },
  { key: 'z_S', label: 'z_S' }
] as const;

const EMPTY_FILTERS: FiltersState = { jnameSearch: '', references: [], numeric: {} };

const isFiltersEmpty = (f: FiltersState) =>
  !f.jnameSearch && f.references.length === 0 &&
  Object.values(f.numeric).every(v => v == null);

const toNum = (x: unknown): number | null => {
  if (typeof x === 'number') return isNaN(x) ? null : x;
  if (typeof x === 'string') {
    const v = parseFloat(x);
    return isNaN(v) ? null : v;
  }
  return null;
};

function tabProps(index: number) {
  return { id: `tab-${index}`, 'aria-controls': `tabpanel-${index}` };
}

const App: React.FC = () => {
  const { data: database = [], isLoading: dbLoading, error: dbError } = useQuery({ queryKey: ['db'], queryFn: loadDatabase });
  const { data: consolidated = [], isLoading: consLoading, error: consError } = useQuery({ queryKey: ['cons'], queryFn: loadConsolidated });
  const { data: dictionary = {} as Record<string, unknown>, isLoading: dictLoading, error: dictError } = useQuery({ queryKey: ['dict'], queryFn: loadDictionary });
  const { data: cutouts = [], isLoading: cutoutsLoading, error: cutoutsError } = useQuery({ queryKey: ['cutouts'], queryFn: loadCutouts });

  const references = useMemo(() => Object.keys(dictionary), [dictionary]);
  const [jname, setJName] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [tab, setTab] = useState(0);

  // Single pass: build unique baseObjects + per-field [min,max] domain.
  // Loop-based min/max avoids stack overflow on Math.min(...) for large arrays.
  const { baseObjects, domain } = useMemo(() => {
    const seen = new Map<string, SkyMapObject>();
    const dom: Record<string, { min: number; max: number }> = {};
    const initDom = (k: string, v: number) => {
      const d = dom[k];
      if (!d) dom[k] = { min: v, max: v };
      else { if (v < d.min) d.min = v; if (v > d.max) d.max = v; }
    };

    for (const r of database) {
      if (!r?.JNAME) continue;
      const RA = toNum(r.RA);
      const DEC = toNum(r.DEC);
      const z_L = toNum(r.z_L);
      const z_S = toNum(r.z_S);
      if (RA != null) initDom('RA', RA);
      if (DEC != null) initDom('DEC', DEC);
      if (z_L != null) initDom('z_L', z_L);
      if (z_S != null) initDom('z_S', z_S);

      const cur = seen.get(r.JNAME);
      if (!cur) {
        seen.set(r.JNAME, { JNAME: r.JNAME, RA, DEC, z_L, z_S });
      } else {
        if (cur.RA == null) cur.RA = RA;
        if (cur.DEC == null) cur.DEC = DEC;
        if (cur.z_L == null) cur.z_L = z_L;
        if (cur.z_S == null) cur.z_S = z_S;
      }
    }
    return { baseObjects: Array.from(seen.values()), domain: dom };
  }, [database]);

  // JNAME -> set of references (built once per dictionary).
  const jnameToRefs = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const ref of references) {
      const entry = dictionary[ref] as { JNAME?: string[] };
      if (!entry || !Array.isArray(entry.JNAME)) continue;
      for (const jn of entry.JNAME) {
        let s = map.get(jn);
        if (!s) { s = new Set(); map.set(jn, s); }
        s.add(ref);
      }
    }
    return map;
  }, [references, dictionary]);

  // Indexes for O(1) lookup of per-JNAME slices.
  const dbByJname = useMemo(() => {
    const m = new Map<string, DataRecord[]>();
    for (const r of database) {
      if (!r?.JNAME) continue;
      const arr = m.get(r.JNAME);
      if (arr) arr.push(r); else m.set(r.JNAME, [r]);
    }
    return m;
  }, [database]);

  const consByJname = useMemo(() => {
    const m = new Map<string, ConsolidatedRecord[]>();
    for (const r of consolidated) {
      if (!r?.JNAME) continue;
      const arr = m.get(r.JNAME);
      if (arr) arr.push(r); else m.set(r.JNAME, [r]);
    }
    return m;
  }, [consolidated]);

  const cutoutsByJname = useMemo(() => {
    const m = new Map<string, CutoutRecord[]>();
    for (const c of cutouts) {
      if (!c?.JNAME) continue;
      const arr = m.get(c.JNAME);
      if (arr) arr.push(c); else m.set(c.JNAME, [c]);
    }
    return m;
  }, [cutouts]);

  const activeNumericKeys = useMemo(
    () => Object.entries(filters.numeric).filter(([, v]) => !!v).map(([k]) => k),
    [filters.numeric]
  );

  // Single debounce on the search term — drawer no longer pre-debounces.
  const debouncedSearch = useDebounce(filters.jnameSearch, 250);

  const filteredObjects = useMemo(() => {
    if (!baseObjects.length) return [];
    const search = debouncedSearch.trim().toLowerCase();
    const useRefs = filters.references.length > 0;
    const refsSet = useRefs ? new Set(filters.references) : null;
    const hasNumeric = activeNumericKeys.length > 0;

    return baseObjects.filter((r) => {
      if (!r?.JNAME) return false;
      if (search && !String(r.JNAME).toLowerCase().includes(search)) return false;
      if (useRefs) {
        const rs = jnameToRefs.get(String(r.JNAME));
        if (!rs) return false;
        let ok = false;
        for (const ref of rs) { if (refsSet!.has(ref)) { ok = true; break; } }
        if (!ok) return false;
      }
      if (hasNumeric) {
        for (const k of activeNumericKeys) {
          const range = filters.numeric[k]!;
          const val = r[k] as number;
          if (typeof val !== 'number' || val < range[0] || val > range[1]) return false;
        }
      }
      return true;
    });
  }, [baseObjects, debouncedSearch, filters.references, filters.numeric, jnameToRefs, activeNumericKeys]);

  const filteredDb = useMemo(() => (jname ? dbByJname.get(jname) ?? [] : []), [dbByJname, jname]);
  const filteredCons = useMemo(() => (jname ? consByJname.get(jname) ?? [] : []), [consByJname, jname]);
  const filteredCutouts = useMemo(() => (jname ? cutoutsByJname.get(jname) ?? [] : []), [cutoutsByJname, jname]);
  const surveys = useMemo(() => Array.from(new Set(filteredCutouts.map(c => String(c.survey)))).sort(), [filteredCutouts]);

  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);
  const handleDrawerToggle = useCallback(() => setDrawerOpen(p => !p), []);
  const handleJNameSelect = useCallback((j: string) => setJName(j), []);
  const handleJNameClear = useCallback(() => setJName(''), []);
  const handleTabChange = useCallback((_: unknown, value: number) => setTab(value), []);

  const allReferences = useMemo(() => [...references].sort(), [references]);

  const anyLoading = dbLoading || consLoading || dictLoading || cutoutsLoading;
  const anyError = dbError || consError || dictError || cutoutsError;
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const panelHeight = isMdUp ? 360 : 300;

  if (anyLoading && !database.length) {
    return (
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar>
            <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>The LaStBeRu Explorer</Typography>
          </Toolbar>
        </AppBar>
        <Container maxWidth="xl" sx={{ py: 3 }}>
          <Paper sx={{ p: 6, textAlign: 'center', mb: 3 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
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
          <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
            <img src="https://raw.githubusercontent.com/CosmoObs/slcomp/refs/heads/main/.figures/slcomp.png" alt="SLComp Logo" style={{ height: 32, width: 80, marginRight: 8, borderRadius: 1, background: '#000' }} />
            <Typography variant="h6" sx={{ fontWeight: 600, letterSpacing: 0.5 }}>The LaStBeRu Explorer</Typography>
          </Box>
          <Box flexGrow={1} />
          <Tooltip title="Filters">
            <IconButton color="primary" onClick={handleDrawerToggle} size="small"><FilterAltIcon /></IconButton>
          </Tooltip>
          <Tooltip title="Reset Filters">
            <span>
              <IconButton color="inherit" onClick={resetFilters} size="small" disabled={isFiltersEmpty(filters)}><ClearAllIcon /></IconButton>
            </span>
          </Tooltip>
          <Box sx={{ ml: 2 }}>
            <Tooltip title="slcomp Repository">
              <IconButton
                color="inherit"
                component="a"
                href="https://github.com/CosmoObs/slcomp"
                target="_blank"
                rel="noopener noreferrer"
                size="small"
                sx={{ p: 0 }}
              >
                <img src="https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png" alt="GitHub" style={{ height: 28, width: 28, borderRadius: '50%' }} />
              </IconButton>
            </Tooltip>
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        {anyLoading && (
          <Paper sx={{ p: 6, textAlign: 'center', mb: 3 }}>
            <CircularProgress size={40} sx={{ mb: 2 }} />
            <Typography variant="body2" color="text.secondary">Loading data...</Typography>
          </Paper>
        )}
        {anyError && (
          <Paper sx={{ p: 4, mb: 3, background: 'linear-gradient(135deg,#281010,#1c0c0c)', border: '1px solid #552' }}>
            <Typography variant="h6" gutterBottom>Error loading data</Typography>
            <Typography variant="body2" color="text.secondary">{String(anyError)}</Typography>
          </Paper>
        )}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Box display="flex" gap={2} alignItems="stretch" sx={{ flexDirection: { xs: 'column', md: 'row' } }}>
            <Box
              sx={{
                flex: { xs: '1 1 auto', md: '0 0 260px' },
                width: { xs: '100%', md: 260 },
                display: 'flex',
                flexDirection: 'column',
                minHeight: 0,
                height: { md: panelHeight }
              }}
            >
              <Box sx={{ flex: 1, minHeight: 0 }}>
                <ObjectsTable
                  objects={filteredObjects}
                  onSelect={handleJNameSelect}
                  selected={jname}
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
          {jname && <Box sx={{ mt: 1, textAlign: 'left' }}><Button size="small" onClick={handleJNameClear}>Clear selection</Button></Box>}
        </Paper>
        {jname ? (
          <Paper sx={{ p: 2 }}>
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
                        if (ra !== rb) return ra - rb;
                        return al.localeCompare(bl);
                      };
                      const cutoutsBySurvey = filteredCutouts.filter(c => c.survey === s).sort(sortBands);
                      return <CutoutGrid key={s} survey={s} cutouts={cutoutsBySurvey} />;
                    })}
                  </Box>
                )}
              </Suspense>
            </Box>
          </Paper>
        ) : (
          <Paper sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="h5" gutterBottom>Select an object</Typography>
            <Typography variant="body1" color="text.secondary">Use the panel for filters to refine your search and click on a JNAME in the table.</Typography>
          </Paper>
        )}
      </Container>
      <FiltersDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        allReferences={allReferences}
        numericFields={NUMERIC_FIELDS as unknown as { key: string; label: string }[]}
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
