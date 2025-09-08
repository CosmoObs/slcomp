import React, { useMemo, useState, useEffect, useCallback, memo } from 'react';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import { Paper, Typography } from '@mui/material';

interface SkyObject {
  JNAME: string;
  [key: string]: unknown;
}

interface Props {
  objects: SkyObject[];
  onSelect: (jname: string)=> void;
  selected: string;
  height?: number;
  fullHeight?: boolean;
}

export const ObjectsTable: React.FC<Props> = memo(({ objects, onSelect, selected, height=360, fullHeight=false }) => {
  // Memoize rows computation to avoid recalculation on every render
  const rows = useMemo(()=> {
    if (!objects || objects.length === 0) return [];
    return objects
      .filter(o=> !!o?.JNAME)
      .map((o,i)=> ({ id: o.JNAME || i, ...o }));
  }, [objects]);
  
  const cols: GridColDef[] = useMemo(()=> [
    { field:'JNAME', headerName:'JNAME', flex:1, minWidth:160 }
  ], []);

  // NOTE: DataGrid MIT version limits pageSize to 100 (larger requires Pro/Premium)
  // Keep state capped at 100 to avoid runtime errors.
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);

  // Optimize callbacks with useCallback and dependency arrays
  const handleRowClick = useCallback((params: any) => {
    onSelect(params.row.JNAME);
  }, [onSelect]);

  const handlePaginationChange = useCallback((model: any) => {
    if (model.page !== page) setPage(model.page);
    if (model.pageSize !== pageSize) {
      // Guard against attempts to exceed MIT cap
      const safeSize = Math.min(100, model.pageSize || 100);
      setPageSize(safeSize);
    }
  }, [page, pageSize]);

  // Optimized selection following with reduced re-computation
  const selectedRowIndex = useMemo(() => {
    if (!selected || !rows.length) return -1;
    return rows.findIndex(r => r.JNAME === selected);
  }, [selected, rows]);

  useEffect(() => {
    if (selectedRowIndex >= 0) {
      const newPage = Math.floor(selectedRowIndex / pageSize);
      if (newPage !== page) setPage(newPage);
    }
  }, [selectedRowIndex, pageSize, page]);

  const header = useMemo(() => (
    <Typography variant="caption" sx={{ pl:1, fontWeight:600, letterSpacing:0.5 }}>
      Filtered Objects ({objects.length})
    </Typography>
  ), [objects.length]);

  // Memoize DataGrid props to prevent unnecessary re-renders
  const dataGridProps = useMemo(() => ({
    rows,
    columns: cols,
    density: "compact" as const,
    disableColumnMenu: true,
    sortingOrder: ['asc','desc'] as const,
    disableRowSelectionOnClick: true,
    onRowClick: handleRowClick,
    getRowClassName: (params: any) => params.row.JNAME === selected ? 'selected-row' : '',
    paginationModel: { page, pageSize },
    onPaginationModelChange: handlePaginationChange,
    // Performance optimizations
    disableVirtualization: false, // Keep virtualization enabled
    rowBufferPx: 100, // Reduce buffer for better performance
    columnBufferPx: 100,
  }), [rows, cols, handleRowClick, selected, page, pageSize, handlePaginationChange]);

  // Memoize styles to prevent recalculation
  const dataGridStyles = useMemo(() => ({
    '& .MuiDataGrid-virtualScroller': { overflowX:'hidden' },
    '& .MuiDataGrid-cell': { fontSize:12 },
    '& .MuiDataGrid-columnHeaders': { background:'rgba(255,255,255,0.04)', backdropFilter:'blur(6px)' },
    '& .selected-row .MuiDataGrid-cell': { background:'rgba(0,120,180,0.25)!important' },
    '& .MuiDataGrid-row:hover': { background:'rgba(255,255,255,0.02)' }
  }), []);

  const paperStyles = useMemo(() => ({
    display:'flex', 
    flexDirection:'column', 
    p:1, 
    height:'100%', 
    background:'rgba(255,255,255,0.02)', 
    backdropFilter:'blur(4px)', 
    border:'1px solid rgba(255,255,255,0.05)'
  }), []);

  if(fullHeight){
    return (
      <Paper sx={paperStyles}>
        {header}
        <div style={{ flex:1, minHeight:0, width:'100%', marginTop:4 }}>
          <DataGrid
            {...dataGridProps}
            hideFooter
            pagination
            sx={{
              height:'100%',
              ...dataGridStyles
            }}
          />
        </div>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p:1, background:'rgba(255,255,255,0.02)', backdropFilter:'blur(4px)', border:'1px solid rgba(255,255,255,0.05)' }}>
      {header}
      <div style={{ height, width:'100%', marginTop:4 }}>
        <DataGrid
          {...dataGridProps}
          pagination
          sx={dataGridStyles}
          // Only expose allowed page sizes within MIT license limit
          pageSizeOptions={[25,50,75,100]}
        />
      </div>
    </Paper>
  );
});

ObjectsTable.displayName = 'ObjectsTable';
