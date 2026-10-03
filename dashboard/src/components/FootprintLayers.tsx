import React, { useEffect, useState, useRef } from 'react';
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Checkbox, CircularProgress, FormControlLabel, Popover, ToggleButton, ToggleButtonGroup, Typography } from '@mui/material';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useQuery } from '@tanstack/react-query';

interface Footprint {
  id: string;
  label: string;
  groups: string[];
  color: string;
  image: string;
  border: string;
}
interface Manifest { layers: Footprint[] }
export type FootprintImage = ImageBitmap | HTMLCanvasElement;
interface CachedImage { promise: Promise<FootprintImage>; controller: AbortController }
const releaseImage = (image: FootprintImage) => {
  if ('close' in image) image.close(); else { image.width = 0; image.height = 0; }
};
const loadImage = async (url: string, signal: AbortSignal): Promise<FootprintImage> => {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  if (typeof createImageBitmap === 'function') {
    return createImageBitmap(blob, { resizeWidth: 1024, resizeHeight: 512, resizeQuality: 'high' });
  }
  const source = new Image();
  const objectUrl = URL.createObjectURL(blob);
  try {
    source.src = objectUrl;
    await source.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 1024; canvas.height = 512;
    canvas.getContext('2d')!.drawImage(source, 0, 0, 1024, 512);
    return canvas;
  } finally { URL.revokeObjectURL(objectUrl); }
};
const BASE = `${import.meta.env.BASE_URL}footprints/`;
const GROUPS = [['surveys', 'Imaging surveys'], ['photometry', 'Photometry'], ['spectroscopy', 'Spectroscopy']];

export const FootprintLayers: React.FC<{ onImages: (images: FootprintImage[]) => void; onOpacity: (opacity: number) => void }> = ({ onImages, onOpacity }) => {
  const imageCache = useRef(new Map<string, CachedImage>());
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [style, setStyle] = useState<'border' | 'area'>('border');
  const [selected, setSelected] = useState<string[]>([]);
  const [imageError, setImageError] = useState(false);
  const [loadingImages, setLoadingImages] = useState(false);
  const { data, isLoading, error } = useQuery<Manifest>({
    queryKey: ['footprint-manifest'], enabled: !!anchor,
    queryFn: async () => {
      const response = await fetch(`${BASE}manifest.json`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    }
  });

  useEffect(() => {
    let cancelled = false;
    setImageError(false);
    const layers = data?.layers.filter(layer => selected.includes(layer.id)) || [];
    onImages([]);
    onOpacity(style === 'border' ? 0.95 : 0.45);
    setLoadingImages(layers.length > 0);
    const urls = layers.map(layer => `${BASE}${style === 'border' ? layer.border : layer.image}`);
    const wanted = new Set(urls);
    for (const [url, cached] of imageCache.current) {
      if (wanted.has(url)) continue;
      cached.controller.abort();
      cached.promise.then(releaseImage).catch(() => {});
      imageCache.current.delete(url);
    }
    const images = urls.map(url => {
      let cached = imageCache.current.get(url);
      if (!cached) {
        const controller = new AbortController();
        const promise = loadImage(url, controller.signal);
        cached = { controller, promise };
        imageCache.current.set(url, cached);
        promise.catch(() => {
          if (imageCache.current.get(url)?.promise === promise) imageCache.current.delete(url);
        });
      }
      return cached.promise;
    });
    Promise.all(images).then(decoded => {
      if (!cancelled) { onImages(decoded); setLoadingImages(false); }
    }).catch(() => {
      if (!cancelled) { setImageError(true); setLoadingImages(false); }
    });
    return () => { cancelled = true; };
  }, [data, selected, style, onImages, onOpacity]);

  useEffect(() => {
    const cache = imageCache.current;
    return () => {
      for (const image of cache.values()) {
        image.controller.abort();
        image.promise.then(releaseImage).catch(() => {});
      }
      cache.clear();
    };
  }, []);

  const toggle = (ids: string[], checked: boolean) => setSelected(previous => checked
    ? Array.from(new Set([...previous, ...ids])) : previous.filter(id => !ids.includes(id)));

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
        {(loadingImages || isLoading) && <CircularProgress size={14} aria-label="Loading layers" />}
        <Button size="small" startIcon={<LayersOutlinedIcon />} onClick={event => setAnchor(event.currentTarget)} aria-haspopup="dialog" aria-expanded={!!anchor}>
          Layers{selected.length ? ` (${selected.length})` : ''}
        </Button>
      </Box>
      {(imageError || error) && <Alert severity="warning" sx={{ mt: 1 }}>Unable to load footprints. Try turning the layers off and on again.</Alert>}
      <Popover open={!!anchor} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }} transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { role: 'dialog', 'aria-label': 'Survey footprints', sx: { width: 340, maxWidth: 'calc(100vw - 32px)', maxHeight: '70vh', bgcolor: '#191e25', border: '1px solid', borderColor: 'divider', p: 1.5 } } }}>
        <Typography variant="subtitle2" sx={{ px: 1, pb: 1 }}>Footprints</Typography>
        <ToggleButtonGroup exclusive size="small" value={style} onChange={(_, value: 'border' | 'area' | null) => { if (value) setStyle(value); }} aria-label="Footprint style" sx={{ display: 'flex', px: 1, pb: 1 }}>
          <ToggleButton value="border" sx={{ flex: 1 }}>Outline</ToggleButton>
          <ToggleButton value="area" sx={{ flex: 1 }}>Area</ToggleButton>
        </ToggleButtonGroup>
        {GROUPS.map(([id, label]) => {
          const layers = data?.layers.filter(layer => layer.groups.includes(id)) || [];
          const count = layers.filter(layer => selected.includes(layer.id)).length;
          return (
            <Accordion key={id} defaultExpanded={id === 'surveys'} disableGutters sx={{ '&:before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography variant="body2">{label}</Typography></AccordionSummary>
              <AccordionDetails sx={{ pt: 0 }}>
                <FormControlLabel label="All" control={<Checkbox size="small" disabled={!layers.length} checked={layers.length > 0 && count === layers.length} indeterminate={count > 0 && count < layers.length} onChange={(_, checked) => toggle(layers.map(layer => layer.id), checked)} inputProps={{ 'aria-label': `All: ${label}` }} />} />
                {layers.map(layer => (
                  <FormControlLabel key={layer.id} sx={{ display: 'flex', m: 0 }} label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><Box sx={{ width: 8, height: 8, bgcolor: layer.color }} /><Typography variant="body2">{layer.label}</Typography></Box>}
                    control={<Checkbox size="small" checked={selected.includes(layer.id)} onChange={(_, checked) => toggle([layer.id], checked)} />} />
                ))}
              </AccordionDetails>
            </Accordion>
          );
        })}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
          <Button size="small" disabled={!selected.length} onClick={() => setSelected([])}>Clear</Button>
          <Button size="small" onClick={() => setAnchor(null)}>Close</Button>
        </Box>
      </Popover>
      {selected.length > 0 && <Box aria-label="Footprint legend" sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', mt: 1 }}>
        {data?.layers.filter(layer => selected.includes(layer.id)).map(layer => <Box key={layer.id} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}><Box sx={{ width: 8, height: 8, bgcolor: layer.color }} /><Typography variant="caption" color="text.secondary">{layer.label}</Typography></Box>)}
      </Box>}
    </>
  );
};
