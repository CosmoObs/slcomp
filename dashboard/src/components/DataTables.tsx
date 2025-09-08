import React from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Box, Typography } from '@mui/material';
import type { DataRecord, ConsolidatedRecord } from '../types';

interface Props {
  database: DataRecord[];
  consolidated: ConsolidatedRecord[];
}

const isAllEmpty = (rows: Record<string, unknown>[], key: string) => {
  return rows.every(r => {
    const v = r[key];
    return v === null || v === undefined || v === '';
  });
};

const autoCols = (rows: Record<string, unknown>[]): GridColDef[] => {
  if(!rows || rows.length === 0) return [];
  const keys = Object.keys(rows[0]).filter(k => k !== 'id');
  const kept = keys.filter(k => !isAllEmpty(rows, k));
  return kept.map((k) => ({
    field: k,
    headerName: k,
    flex: 1,
    minWidth: 120,
    headerAlign: 'center',
    align: 'center'
  }));
};

export const DataTables: React.FC<Props> = ({ database, consolidated }) => {
  const dbCols = autoCols(database);
  const consCols = autoCols(consolidated);
  return (
    <Box display="flex" flexDirection="column" gap={6}>
      <Box>
        <Typography variant="h6" sx={{ mb: 1, textAlign:'left' }}>Full Dataset Record</Typography>
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <DataGrid
            autoHeight
            disableColumnMenu
            disableRowSelectionOnClick
            density="compact"
            rows={database.map((r:DataRecord,i:number)=>({id:i,...r}))}
            columns={dbCols}
            getRowId={(r: Record<string, unknown> & { id: number })=>r.id}
            rowSelection={false}
            initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
            sx={{
              '& .MuiDataGrid-cell': { justifyContent: 'center' },
              '& .MuiDataGrid-columnHeaders': { background: 'rgba(255,255,255,0.04)' },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
              '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(255,255,255,0.02)' },
              border: '1px solid rgba(90,170,200,0.25)',
              borderRadius: 2
            }}
          />
        </Box>
      </Box>
      <Box>
        <Typography variant="h6" sx={{ mb: 1, textAlign:'left' }}>Consolidated Parameters</Typography>
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <DataGrid
            autoHeight
            disableColumnMenu
            disableRowSelectionOnClick
            density="compact"
            rows={consolidated.map((r:ConsolidatedRecord,i:number)=>({id:i,...r}))}
            columns={consCols}
            getRowId={(r: Record<string, unknown> & { id: number })=>r.id}
            rowSelection={false}
            initialState={{ pagination: { paginationModel: { pageSize: 50, page: 0 } } }}
            sx={{
              '& .MuiDataGrid-cell': { justifyContent: 'center' },
              '& .MuiDataGrid-columnHeaders': { background: 'rgba(255,255,255,0.04)' },
              '& .MuiDataGrid-columnHeaderTitle': { fontWeight: 600 },
              '& .MuiDataGrid-row:nth-of-type(even)': { backgroundColor: 'rgba(255,255,255,0.02)' },
              border: '1px solid rgba(90,170,200,0.25)',
              borderRadius: 2
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};
