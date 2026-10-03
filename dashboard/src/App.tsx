import React, { useMemo, useState, lazy, Suspense, useCallback } from 'react';
import { AppBar, Alert, Box, Chip, Collapse, Container, Divider, InputAdornment, LinearProgress, Tab, Tabs, TextField, Toolbar, Typography, Paper, IconButton, Tooltip, Button, CircularProgress } from '@mui/material';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import GitHubIcon from '@mui/icons-material/GitHub';
import PublicIcon from '@mui/icons-material/Public';
import { useQuery } from '@tanstack/react-query';
import { loadCatalog, loadDetails, loadDictionary, dataBucket } from './api';
const DataTables = lazy(() => import('./components/DataTables').then(m => ({ default: m.DataTables })));
const CutoutGrid = lazy(() => import('./components/CutoutGrid').then(m => ({ default: m.CutoutGrid })));
import { FiltersDrawer, FiltersState, NumericFilterConfig } from './components/FiltersDrawer';
import { ObjectsTable } from './components/ObjectsTable';
const ObservatorySurprise = lazy(() => import('./components/ObservatorySurprise').then(m => ({ default: m.ObservatorySurprise })));
const SkyMap = lazy(() => import('./components/SkyMap').then(m => ({ default: m.SkyMap })));
const EMPTY_DETAILS: ObjectDetails = { database: [], consolidated: [], cutouts: [] };
const EMPTY_OBJECTS: import('./api').CatalogObject[] = [];
const EMPTY_DOMAIN: Record<string, { min: number; max: number }> = {};
import { useDebounce } from './hooks/useDebounce';
import type { CutoutRecord } from './types';
import type { ObjectDetails } from './api';

const NUMERIC_FIELDS = [
  { key: 'RA', label: 'RA' },
  { key: 'DEC', label: 'DEC' },
  { key: 'z_L', label: 'z_L' },
  { key: 'z_S', label: 'z_S' }
] as const satisfies readonly NumericFilterConfig[];

const EMPTY_FILTERS: FiltersState = { jnameSearch: '', references: [], numeric: {} };

const isFiltersEmpty = (f: FiltersState) =>
  !f.jnameSearch && f.references.length === 0 &&
  Object.values(f.numeric).every(v => v == null);

function tabProps(index: number) {
  return { id: `tab-${index}`, 'aria-controls': `tabpanel-${index}` };
}

const App: React.FC = () => {
  const { data: catalog, isLoading: dbLoading, error: dbError } = useQuery({ queryKey: ['catalog'], queryFn: ({ signal }) => loadCatalog(signal), staleTime: Infinity });
  const { data: dictionary = {} as Record<string, unknown>, isLoading: dictLoading, error: dictError } = useQuery({ queryKey: ['dict'], queryFn: loadDictionary, staleTime: Infinity });
  const references = useMemo(() => Object.keys(dictionary), [dictionary]);
  const [jname, setJName] = useState<string>('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [tab, setTab] = useState(0);
  const [mapOpen, setMapOpen] = useState(false);
  const [surpriseOpen, setSurpriseOpen] = useState(false);

  const baseObjects = catalog?.objects ?? EMPTY_OBJECTS;
  const domain = catalog?.domain ?? EMPTY_DOMAIN;
  const bucket = dataBucket(jname);
  const selectDetails = useCallback((shard: Record<string, ObjectDetails>) => shard[jname] ?? EMPTY_DETAILS, [jname]);
  const { data: details = EMPTY_DETAILS, isLoading: detailsLoading, error: detailsError } = useQuery({
    queryKey: ['object-details', bucket], enabled: !!jname,
    queryFn: ({ signal }) => loadDetails(bucket, signal), select: selectDetails,
    staleTime: Infinity, gcTime: 2 * 60 * 1000
  });
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

  const filteredDb = details.database;
  const filteredCons = details.consolidated;
  const filteredCutouts = details.cutouts;
  const surveyImages = useMemo(() => {
    const groups = new Map<string, CutoutRecord[]>();
    for (const cutout of filteredCutouts) {
      const group = groups.get(cutout.survey);
      if (group) group.push(cutout); else groups.set(cutout.survey, [cutout]);
    }
    const rank = (c: CutoutRecord) => String(c.band).toLowerCase() === 'lsb' ? 0 : String(c.band).toLowerCase() === 'trilogy' ? 1 : 2;
    return Array.from(groups).sort(([a], [b]) => a.localeCompare(b)).map(([survey, images]) => ({
      survey, images: images.sort((a, b) => rank(a) - rank(b) || String(a.band).localeCompare(String(b.band)))
    }));
  }, [filteredCutouts]);

  const resetFilters = useCallback(() => setFilters(EMPTY_FILTERS), []);
  const handleDrawerToggle = useCallback(() => setDrawerOpen(p => !p), []);
  const handleJNameSelect = useCallback((j: string) => setJName(j), []);
  const handleJNameClear = useCallback(() => setJName(''), []);
  const handleTabChange = useCallback((_: unknown, value: number) => setTab(value), []);

  const allReferences = useMemo(() => [...references].sort(), [references]);

  const anyLoading = dbLoading || dictLoading || (!!jname && detailsLoading);
  const anyError = dbError || dictError || detailsError;
  const selectedObject = useMemo(() => baseObjects.find(o => o.JNAME === jname), [baseObjects, jname]);
  const handleSurprise = useCallback(() => setSurpriseOpen(true), []);
  const advancedFilterCount = filters.references.length + activeNumericKeys.length;
  const formatValue = (value: unknown, digits: number) =>
    typeof value === 'number' && Number.isFinite(value) ? value.toFixed(digits) : '—';

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="static" elevation={0}>
        <Toolbar sx={{ gap: 2, maxWidth: 1440, width: '100%', mx: 'auto', px: { xs: 2, md: 4 } }}>
          <Box component="img" src={`${import.meta.env.BASE_URL}slcomp.webp`} alt="SLComp" sx={{ width: 88, height: 38, objectFit: 'contain' }} />
          <Typography variant="subtitle1" sx={{ flex: 1, fontWeight: 600 }}>LaStBeRu Explorer</Typography>
          <Tooltip title="View repository on GitHub">
            <IconButton component="a" href="https://github.com/CosmoObs/slcomp" target="_blank" rel="noopener noreferrer" aria-label="View repository on GitHub">
              <GitHubIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>
      <Container maxWidth={false} component="main" sx={{ maxWidth: 1440, px: { xs: 2, md: 4 }, py: { xs: 3, md: 4 } }}>
        <Typography variant="h4" sx={{ mb: 3 }}>Explore LaStBeRu objects</Typography>

        {anyError && <Alert severity="error" sx={{ mb: 2 }}>Could not load catalog data. {String(anyError)}</Alert>}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              fullWidth
              placeholder="Search JNAME, e.g. J084317.9+230501.2"
              value={filters.jnameSearch}
              onChange={e => setFilters(prev => ({ ...prev, jnameSearch: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter' && filteredObjects.length === 1 && filters.jnameSearch.trim().toLowerCase() === debouncedSearch.trim().toLowerCase()) {
                  handleJNameSelect(filteredObjects[0].JNAME);
                }
              }}
              inputProps={{ 'aria-label': 'Search catalog by JNAME' }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon sx={{ color: 'text.secondary' }} /></InputAdornment>,
                endAdornment: filters.jnameSearch ? <InputAdornment position="end"><IconButton size="small" aria-label="Clear search" onClick={() => setFilters(prev => ({ ...prev, jnameSearch: '' }))}><CloseIcon fontSize="small" /></IconButton></InputAdornment> : undefined
              }}
              sx={{ flex: '1 1 300px' }}
            />
            <Button variant="text" startIcon={<FilterAltIcon />} onClick={handleDrawerToggle} sx={{ height: 48 }}>
              Filters{advancedFilterCount > 0 ? ` (${advancedFilterCount})` : ''}
            </Button>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 1.5, flexWrap: 'wrap' }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }} aria-live="polite">
              {dbLoading ? 'Loading catalog…' : `${filteredObjects.length.toLocaleString()} of ${baseObjects.length.toLocaleString()} objects`}
            </Typography>
            {!isFiltersEmpty(filters) && <Button size="small" onClick={resetFilters}>Reset filters</Button>}
            <Button size="small" startIcon={<PublicIcon />} onClick={() => setMapOpen(prev => !prev)} aria-expanded={mapOpen} aria-controls="sky-map-panel" color={mapOpen ? 'primary' : 'inherit'}>
              {mapOpen ? 'Hide sky map' : 'Show sky map'}
            </Button>
          </Box>
          {advancedFilterCount > 0 && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
              {filters.references.map(ref => <Chip key={ref} label={ref} size="small" onDelete={() => setFilters(prev => ({ ...prev, references: prev.references.filter(r => r !== ref) }))} />)}
              {activeNumericKeys.map(key => <Chip key={key} label={`${key}: ${filters.numeric[key]!.map(v => Number(v.toFixed(3))).join(' – ')}`} size="small" onDelete={() => setFilters(prev => ({ ...prev, numeric: { ...prev.numeric, [key]: null } }))} />)}
            </Box>
          )}
        </Box>

        <Collapse in={mapOpen} unmountOnExit>
          <Box id="sky-map-panel" sx={{ mb: 3 }}>
            <Suspense fallback={<CircularProgress size={24} />}><SkyMap objects={filteredObjects} selected={jname} onSelect={handleJNameSelect} onSurprise={handleSurprise} height={280} /></Suspense>
          </Box>
        </Collapse>

        {dbLoading && !baseObjects.length ? (
          <Paper sx={{ py: 10, textAlign: 'center' }}>
            <CircularProgress size={28} sx={{ mb: 2 }} />
            <Typography color="text.secondary">Loading the catalog…</Typography>
          </Paper>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: '320px minmax(0, 1fr)' }, gap: { xs: 3, md: 4 }, alignItems: 'start' }}>
            <ObjectsTable objects={filteredObjects} onSelect={handleJNameSelect} selected={jname} height={540} />
            <Paper sx={{ minWidth: 0, overflow: 'hidden', minHeight: { md: 540 } }}>
              {jname ? (
                <>
                  <Box sx={{ p: { xs: 2, md: 3 } }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 1 }}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="overline" color="text.secondary">Object details</Typography>
                        <Typography variant="h5" sx={{ fontFamily: 'monospace', overflowWrap: 'anywhere' }}>{jname}</Typography>
                      </Box>
                      <Tooltip title="Clear selection"><IconButton size="small" onClick={handleJNameClear} aria-label="Clear selection"><CloseIcon fontSize="small" /></IconButton></Tooltip>
                    </Box>
                    {!filteredObjects.some(o => o.JNAME === jname) && <Chip size="small" label="Outside current results" sx={{ mt: 1 }} />}
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(4, minmax(0, 1fr))' }, gap: { xs: 1, md: 2 }, mt: 3 }}>
                      {[['RA (°)', formatValue(selectedObject?.RA, 5)], ['DEC (°)', formatValue(selectedObject?.DEC, 5)], ['Lens z', formatValue(selectedObject?.z_L, 3)], ['Source z', formatValue(selectedObject?.z_S, 3)]].map(([label, value]) => (
                        <Box key={label}>
                          <Typography variant="caption" color="text.secondary">{label}</Typography>
                          <Typography variant="body2" sx={{ fontFamily: 'monospace', mt: 0.5, overflowWrap: 'anywhere' }}>{value}</Typography>
                        </Box>
                      ))}
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.5 }}>Summary from catalog records. See the tables below for reported values.</Typography>
                  </Box>
                  <Divider />
                  <Tabs value={tab} onChange={handleTabChange} variant="scrollable" sx={{ px: { xs: 2, md: 3 } }}>
                    <Tab label={`Records (${selectedObject?.recordCount ?? filteredDb.length})`} {...tabProps(0)} />
                    <Tab label={`Images (${selectedObject?.imageCount ?? filteredCutouts.length})`} {...tabProps(1)} />
                  </Tabs>
                  {anyLoading && <LinearProgress />}
                  <Box role="tabpanel" id={`tabpanel-${tab}`} aria-labelledby={`tab-${tab}`} sx={{ p: { xs: 2, md: 3 } }}>
                    <Suspense fallback={<Typography variant="body2" color="text.secondary">Loading details…</Typography>}>
                      {detailsLoading ? <Typography variant="body2" color="text.secondary">Loading details…</Typography> : <>
                        {tab === 0 && <DataTables database={filteredDb} consolidated={filteredCons} />}
                        {tab === 1 && (filteredCutouts.length ? surveyImages.map(({ survey, images }) =>
                          <CutoutGrid key={survey} survey={survey} cutouts={images} />
                        ) : <Typography variant="body2" color="text.secondary">No cutout images available for this object.</Typography>)}
                      </>}
                    </Suspense>
                  </Box>
                </>
              ) : (
                <Box sx={{ minHeight: { xs: 300, md: 538 }, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', px: 3, textAlign: 'center' }}>
                  <SearchIcon sx={{ color: 'text.secondary', fontSize: 32, mb: 2 }} />
                  <Typography variant="h6" sx={{ mb: 1 }}>Explore an object</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 330 }}>Select a JNAME from the results to view its coordinates, catalog records and survey images.</Typography>

                </Box>
              )}
            </Paper>
          </Box>
        )}
      </Container>
      {surpriseOpen && <Suspense fallback={<CircularProgress size={24} />}><ObservatorySurprise open onClose={() => setSurpriseOpen(false)} /></Suspense>}
      <FiltersDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} allReferences={allReferences} numericFields={NUMERIC_FIELDS} domain={domain} value={filters} onChange={setFilters} onReset={resetFilters} totalCount={baseObjects.length} filteredCount={filteredObjects.length} />
    </Box>
  );
};

export default App;
