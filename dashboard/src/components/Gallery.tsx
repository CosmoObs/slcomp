import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Box, Chip, Dialog, DialogContent, DialogTitle, Grid, IconButton, LinearProgress, Stack, Tooltip, Typography } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import CloseIcon from '@mui/icons-material/Close';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowForwardIosIcon from '@mui/icons-material/ArrowForwardIos';
import type { CutoutRecord } from '../types';
import { getCutoutObject, revokeBlobUrl } from '../api';

interface GalleryProps {
  cutouts: CutoutRecord[];
}

interface ImgEntry {
  key: string;
  survey: string;
  band: string;
  file_path: string;
  url: string | null;
}

export const Gallery: React.FC<GalleryProps> = ({ cutouts }) => {
  const ordered = useMemo(() => [...cutouts].sort((a,b)=> a.survey.localeCompare(b.survey) || a.band.localeCompare(b.band)), [cutouts]);
  const surveys = useMemo(()=> Array.from(new Set(ordered.map(c=> c.survey))).sort(), [ordered]);
  const [activeSurveyFilter, setActiveSurveyFilter] = useState<string | 'ALL'>('ALL');
  const [images, setImages] = useState<ImgEntry[]>([]);
  const [loadedCount, setLoadedCount] = useState(0);
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const filtered = useMemo(()=> activeSurveyFilter === 'ALL' ? ordered : ordered.filter(c=> c.survey === activeSurveyFilter), [ordered, activeSurveyFilter]);

  useEffect(()=>{
    let cancelled = false;
    setImages([]);
    setLoadedCount(0);
    if(filtered.length === 0) return;
    
    // Clean up previous blob URLs
    images.forEach(img => {
      if (img.url) {
        revokeBlobUrl(img.url);
      }
    });
    
    (async () => {
      const entries: ImgEntry[] = [];
      for(const c of filtered){
        try {
          const url = await getCutoutObject(c.file_path);
          if(cancelled) return;
          entries.push({ key: c.file_path, survey: c.survey, band: c.band, file_path: c.file_path, url });
        } catch {
          if(cancelled) break;
          entries.push({ key: c.file_path, survey: c.survey, band: c.band, file_path: c.file_path, url: null });
        }
        if(cancelled) break;
        setLoadedCount(v=> v+1);
        setImages(e=> [...e, ...entries.filter(ne=> !e.find(prev => prev.key === ne.key))]);
      }
    })();
    return () => { 
      cancelled = true;
      // Clean up blob URLs when component unmounts
      images.forEach(img => {
        if (img.url) {
          revokeBlobUrl(img.url);
        }
      });
    };
  }, [filtered]);

  const progress = filtered.length === 0 ? 0 : Math.min(100, Math.round( (loadedCount / filtered.length) * 100));

  const openModal = (idx: number) => setOpenIdx(idx);
  const closeModal = () => setOpenIdx(null);
  const next = useCallback(()=> setOpenIdx(i => (i === null ? i : (i + 1) % images.length)), [images.length]);
  const prev = useCallback(()=> setOpenIdx(i => (i === null ? i : (i - 1 + images.length) % images.length)), [images.length]);

  useEffect(()=>{
    if(openIdx === null) return;
    const handler = (e: KeyboardEvent) => {
      if(e.key === 'Escape') closeModal();
      if(e.key === 'ArrowRight') next();
      if(e.key === 'ArrowLeft') prev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [openIdx, next, prev]);

  const current = openIdx !== null ? images[openIdx] : null;

  return (
    <Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" mb={2}>
        <Chip label="ALL" color={activeSurveyFilter==='ALL' ? 'primary':'default'} onClick={()=> setActiveSurveyFilter('ALL')} size="small" />
        {surveys.map(s => <Chip key={s} label={s} color={activeSurveyFilter===s?'primary':'default'} onClick={()=> setActiveSurveyFilter(s)} size="small" />)}
      </Stack>
      {filtered.length > 0 && progress < 100 && (
        <Box mb={2}>
          <Typography variant="caption" color="text.secondary">Loading images {loadedCount}/{filtered.length}</Typography>
          <LinearProgress variant="determinate" value={progress} sx={{ mt:0.5 }} />
        </Box>
      )}
      {filtered.length === 0 && <Typography variant="body2" color="text.secondary">No cutouts found.</Typography>}
      <Grid container spacing={2}>
        {images.map((img, idx) => (
          <Grid item key={img.key} xs={6} sm={4} md={3} lg={2} onClick={()=> openModal(idx)} style={{ cursor: img.url ? 'pointer':'default' }}>
            <Box sx={{ position:'relative', border:'1px solid rgba(90,170,200,0.3)', borderRadius:2, overflow:'hidden', background:'linear-gradient(145deg,#18313b,#0d1c23)', p:1, minHeight:140, display:'flex', flexDirection:'column', justifyContent:'space-between' }}>
              <Box sx={{ flexGrow:1, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {img.url ? (<img src={img.url} style={{ maxWidth:'100%', maxHeight:120, objectFit:'contain' }} />) : (<Typography variant="caption" color="text.secondary">No image</Typography>)}
              </Box>
              <Typography variant="caption" sx={{ mt:0.5, fontSize:'0.65rem', letterSpacing:0.3 }} color="primary.light">{img.survey} – {img.band}</Typography>
            </Box>
          </Grid>
        ))}
      </Grid>

      <Dialog open={openIdx !== null && !!current} onClose={closeModal} maxWidth="lg" fullWidth>
        {current && (
          <>
            <DialogTitle sx={{ display:'flex', alignItems:'center', pr:6 }}>
              <Typography variant="subtitle1" sx={{ flexGrow:1 }}>{current.survey} – {current.band}</Typography>
              <Tooltip title="Download raw">
                <span>
                  {current.url && <IconButton size="small" component="a" href={current.url} download={current.file_path}><DownloadIcon fontSize="small" /></IconButton>}
                </span>
              </Tooltip>
              <IconButton onClick={closeModal} size="small" sx={{ ml:1 }}><CloseIcon fontSize="small" /></IconButton>
            </DialogTitle>
            <DialogContent sx={{ display:'flex', flexDirection:'column', alignItems:'center', bgcolor:'#0b1419' }}>
              <Box sx={{ display:'flex', alignItems:'center', width:'100%', justifyContent:'space-between', mb:2 }}>
                <IconButton onClick={prev} disabled={images.length<=1}><ArrowBackIosNewIcon fontSize="small" /></IconButton>
                <Typography variant="caption" color="text.secondary">{(openIdx||0)+1}/{images.length}</Typography>
                <IconButton onClick={next} disabled={images.length<=1}><ArrowForwardIosIcon fontSize="small" /></IconButton>
              </Box>
              {current.url ? (
                <Box sx={{ maxWidth:'100%', maxHeight:'70vh' }}>
                  <img src={current.url} style={{ maxWidth:'100%', maxHeight:'70vh', objectFit:'contain', borderRadius:4 }} />
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">Image not available.</Typography>
              )}
            </DialogContent>
          </>
        )}
      </Dialog>
    </Box>
  );
};
