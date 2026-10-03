import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { catalogTheme } from './theme';
import App from './App';

class ErrorBoundary extends React.Component<{children: React.ReactNode}, {error: any}> {
  constructor(props:any){
    super(props); this.state = { error: null };
  }
  static getDerivedStateFromError(error:any){ return { error }; }
  componentDidCatch(err:any, info:any){ console.error('App crashed:', err, info); }
  render(){
    if(this.state.error){
      return <div style={{padding:24,fontFamily:'monospace',color:'#eee'}}>
        <h2>Application Error</h2>
        <pre>{String(this.state.error)}</pre>
        <p>Check console for stack trace.</p>
      </div>;
    }
    return this.props.children;
  }
}

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutos
      gcTime: 10 * 60 * 1000, // 10 minutos (cache GC time)
      retry: 1, // Reduzir tentativas de retry
      refetchOnWindowFocus: false, // Avoid unnecessary refetching
    },
  },
});

// Blob lifetime follows the query cache, including cancelled/background queries.
qc.getQueryCache().subscribe(event => {
  if (event.type !== 'removed' || event.query.queryKey[0] !== 'cutout') return;
  const url = event.query.state.data;
  if (typeof url === 'string' && url.startsWith('blob:')) URL.revokeObjectURL(url);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <QueryClientProvider client={qc}>
    <ThemeProvider theme={catalogTheme}>
      <CssBaseline />
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </ThemeProvider>
  </QueryClientProvider>
);
