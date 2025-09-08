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
  const rows = useMemo(()=> objects
    .filter(o=> !!o && !!o.JNAME)
    .map((o,i)=> ({ id: o.JNAME || i, ...o })), [objects]);
  const cols: GridColDef[] = useMemo(()=> [
    { field:'JNAME', headerName:'JNAME', flex:1, minWidth:160 }
  ], []);

  // Pagination state
  const [pageSize, setPageSize] = useState(100); // Aumentado de 80 para 100
  const [page, setPage] = useState(0);

  // Otimização: usar useCallback para evitar re-criação da função
  const handleRowClick = useCallback((params: any) => {
    onSelect(params.row.JNAME);
  }, [onSelect]);

  const handlePaginationChange = useCallback((model: any) => {
    setPage(model.page);
    setPageSize(model.pageSize);
  }, []);

  // Ensure selected row visible by jumping to its page when selection changes
  useEffect(()=> {
    if(!selected) return;
    const idx = rows.findIndex(r=> r.JNAME === selected);
    if(idx >=0){
      const newPage = Math.floor(idx / pageSize);
      if(newPage !== page) setPage(newPage);
    }
  }, [selected, rows, pageSize, page]);

  const header = (
    <Typography variant="caption" sx={{ pl:1, fontWeight:600, letterSpacing:0.5 }}>
  Filtered Objects
    </Typography>
  );

  // Otimização: memoizar props comuns do DataGrid
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
  }), [rows, cols, handleRowClick, selected, page, pageSize, handlePaginationChange]);

  if(fullHeight){
    return (
      <Paper sx={{ display:'flex', flexDirection:'column', p:1, height:'100%', background:'rgba(255,255,255,0.02)', backdropFilter:'blur(4px)', border:'1px solid rgba(255,255,255,0.05)' }}>
        {header}
        <div style={{ flex:1, minHeight:0, width:'100%', marginTop:4 }}>
          <DataGrid
            {...dataGridProps}
            hideFooter
            pagination
            sx={{
              height:'100%',
              '& .MuiDataGrid-virtualScroller': { overflowX:'hidden' },
              '& .MuiDataGrid-cell': { fontSize:12 },
              '& .MuiDataGrid-columnHeaders': { background:'rgba(255,255,255,0.04)', backdropFilter:'blur(6px)' },
              '& .selected-row .MuiDataGrid-cell': { background:'rgba(0,120,180,0.25)!important' }
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
          sx={{
            '& .MuiDataGrid-cell': { fontSize:12 },
            '& .MuiDataGrid-columnHeaders': { background:'rgba(255,255,255,0.04)', backdropFilter:'blur(6px)' },
            '& .selected-row .MuiDataGrid-cell': { background:'rgba(0,120,180,0.25)!important' }
          }}
          pageSizeOptions={[50,100,200,500]}
        />
      </div>
    </Paper>
  );
});

ObjectsTable.displayName = 'ObjectsTable';
