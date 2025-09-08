import React, { memo } from 'react';
import { Box, Grid, Typography, Paper, Skeleton } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { getCutoutObject } from '../api';
import type { CutoutRecord } from '../types';

interface Props {
  survey: string;
  cutouts: CutoutRecord[];
}

export const CutoutGrid: React.FC<Props> = memo(({ survey, cutouts }) => {
  return (
    <Box mt={2}>
      <Typography variant="h6" gutterBottom>{survey}</Typography>
      <Grid container spacing={2}>
        {cutouts.map(c => (
          <Grid item key={c.file_path} xs={6} sm={4} md={2}>
            <CutoutCard record={c} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
});

CutoutGrid.displayName = 'CutoutGrid';

const CutoutCard: React.FC<{ record: CutoutRecord }> = memo(({ record }) => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['cutout', record.file_path],
    queryFn: () => getCutoutObject(record.file_path),
    staleTime: 5 * 60 * 1000, // 5 minutos de cache
    retry: 1, // Only retry once for ngrok issues
  });
  
  return (
    <Paper sx={{ p: 1.5, textAlign: 'center', background: 'linear-gradient(145deg, rgba(40,65,75,0.6), rgba(25,40,50,0.4))', border: '1px solid rgba(90,170,200,0.3)' }}>
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing:0.5 }}>{record.band}</Typography>
      <Box mt={1} sx={{ position:'relative', width:'100%', maxWidth:160, mx:'auto' }}>
        <Box sx={{ position:'relative', width:'100%', pt:'100%', borderRadius:2, overflow:'hidden', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(90,170,200,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
        {isLoading && <Skeleton variant="rectangular" width="100%" height="100%" sx={{ position:'absolute', inset:0 }} />}
        {!isLoading && data && <img
          src={data}
          loading="lazy"
          decoding="async"
          alt={record.band + ' cutout'}
          style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'contain', imageRendering:'auto' }}
          onError={(e)=>{
            const img = e.currentTarget;
            if(img.dataset.fallbackTried) return;
            img.dataset.fallbackTried = '1';
            
            // For ngrok URLs, try adding the bypass parameters as query string
            if (img.src.includes('ngrok')) {
              const url = new URL(img.src);
              url.searchParams.set('skip_zrok_interstitial', 'true');
              img.src = url.toString();
              return;
            }
            
            // Extension fallback: try .jpeg -> .png -> .jpg
            const order = ['.jpeg','.png','.jpg'];
            const current = order.find(ext => img.src.toLowerCase().includes(ext));
            const nextExt = current ? order[(order.indexOf(current)+1)%order.length] : null;
            if(nextExt){
              const newSrc = img.src.replace(/\.(jpeg|png|jpg)(?=($|\?))/i, nextExt);
              if(newSrc !== img.src) img.src = newSrc;
            }
          }} />}
        {!isLoading && !data && !error && <Typography variant="caption" color="text.secondary" sx={{ textAlign:'center', px:0.5, position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>No image</Typography>}
        {error && <Typography variant="caption" color="error" sx={{ textAlign:'center', px:0.5, position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>Error</Typography>}
        </Box>
      </Box>
      {error && <Typography variant="caption" color="error" sx={{ display:'block', mt:0.5 }}>Err</Typography>}
    </Paper>
  );
});

CutoutCard.displayName = 'CutoutCard';
