import React, { memo, useState, useEffect, useRef } from 'react';
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
          <Grid item key={c.file_path} xs={6} sm={4} lg={3}>
            <CutoutCard record={c} />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
});

CutoutGrid.displayName = 'CutoutGrid';

const CutoutCard: React.FC<{ record: CutoutRecord }> = memo(({ record }) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [nearViewport, setNearViewport] = useState(false);
  useEffect(() => {
    const element = cardRef.current;
    if (!element) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) { setNearViewport(true); observer.disconnect(); }
    }, { rootMargin: '200px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const { data, isPending: isLoading, error: queryError } = useQuery({
    queryKey: ['cutout', record.file_path], enabled: nearViewport,
    queryFn: ({ signal }) => getCutoutObject(record.file_path, signal),
    staleTime: Infinity, gcTime: 60 * 1000, retry: 1
  });

  // getCutoutObject swallows fetch errors and falls back to the raw URL so
  // the <img> still gets a chance (the browser may succeed where fetch failed
  // due to CORS preflight). If the <img> itself fails to load, surface that
  // here — otherwise the broken image renders silently.
  const [imgError, setImgError] = useState(false);
  React.useEffect(() => { setImgError(false); }, [data]);
  const showError = !!queryError || imgError;

  return (
    <Paper ref={cardRef} sx={{ p: 0, textAlign: 'center' }}>
      <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5 }}>{record.band}</Typography>
      <Box mt={1} sx={{ position: 'relative', width: '100%', maxWidth: 220, mx: 'auto' }}>
        <Box sx={{ position: 'relative', width: '100%', pt: '100%', borderRadius: 0, overflow: 'hidden', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isLoading && <Skeleton variant="rectangular" width="100%" height="100%" sx={{ position: 'absolute', inset: 0 }} />}
          {!isLoading && data && !imgError && (
            <img
              src={data}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              alt={`${record.JNAME} · ${record.survey} · ${record.band}`}
              onError={() => setImgError(true)}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
            />
          )}
          {!isLoading && !data && !showError && (
            <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', px: 0.5, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              No image
            </Typography>
          )}
          {showError && (
            <Typography variant="caption" color="error" sx={{ textAlign: 'center', px: 0.5, position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              Image unavailable
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
});

CutoutCard.displayName = 'CutoutCard';
