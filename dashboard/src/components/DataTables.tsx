import React, { useEffect, useMemo, useState } from 'react';
import { Box, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Typography } from '@mui/material';
import type { DataRecord, ConsolidatedRecord } from '../types';

interface Props {
  database: DataRecord[];
  consolidated: ConsolidatedRecord[];
}

const isEmptyVal = (v: unknown) => v === null || v === undefined || v === '';

const formatCell = (v: unknown): string => {
  if (isEmptyVal(v)) return '';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toString();
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

interface SimpleTableProps {
  rows: Record<string, unknown>[];
}

const SimpleTable: React.FC<SimpleTableProps> = ({ rows }) => {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  // Union of keys across all rows (heterogeneous rows can introduce columns
  // not present on the first one). Then drop columns that are empty everywhere.
  const columns = useMemo(() => {
    if (rows.length === 0) return [] as string[];
    const keySet = new Set<string>();
    for (const r of rows) {
      for (const k of Object.keys(r)) if (k !== 'id') keySet.add(k);
    }
    return Array.from(keySet).filter(k => !rows.every(r => isEmptyVal(r[k])));
  }, [rows]);

  // Clamp `page` whenever `rows` shrinks past the current page.
  useEffect(() => {
    const lastPage = Math.max(0, Math.ceil(rows.length / pageSize) - 1);
    if (page > lastPage) setPage(lastPage);
  }, [rows.length, pageSize, page]);

  const pageRows = useMemo(() => {
    const start = page * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  if (rows.length === 0) {
    return <Typography variant="body2" color="text.secondary">No rows.</Typography>;
  }

  return (
    <Box sx={{ width: '100%', border: '1px solid rgba(90,170,200,0.25)', borderRadius: 2, overflow: 'hidden' }}>
      <TableContainer sx={{ maxHeight: 480 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map(c => (
                <TableCell
                  key={c}
                  align="center"
                  sx={{
                    fontWeight: 600,
                    fontSize: 12,
                    background: '#0f1c27',
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {c}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((r, i) => (
              <TableRow
                key={i}
                sx={{
                  '&:nth-of-type(even)': { backgroundColor: 'rgba(255,255,255,0.02)' },
                  '&:hover': { backgroundColor: 'rgba(255,255,255,0.04)' }
                }}
              >
                {columns.map(c => (
                  <TableCell
                    key={c}
                    align="center"
                    sx={{ fontSize: 12, borderBottom: '1px solid rgba(255,255,255,0.04)', whiteSpace: 'nowrap' }}
                  >
                    {formatCell(r[c])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={rows.length}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={pageSize}
        onRowsPerPageChange={(e) => { setPageSize(parseInt(e.target.value, 10)); setPage(0); }}
        rowsPerPageOptions={[25, 50, 100]}
        sx={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
      />
    </Box>
  );
};

export const DataTables: React.FC<Props> = ({ database, consolidated }) => {
  return (
    <Box display="flex" flexDirection="column" gap={6}>
      <Box>
        <Typography variant="h6" sx={{ mb: 1, textAlign: 'left' }}>Full Dataset Record</Typography>
        <SimpleTable rows={database as Record<string, unknown>[]} />
      </Box>
      <Box>
        <Typography variant="h6" sx={{ mb: 1, textAlign: 'left' }}>Consolidated Parameters</Typography>
        <SimpleTable rows={consolidated as Record<string, unknown>[]} />
      </Box>
    </Box>
  );
};
