import { createTheme, alpha } from '@mui/material/styles';

const customShadows = [
  'none',
  '0 2px 4px -2px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.02)',
  '0 4px 12px -2px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.02)',
  '0 6px 18px -4px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.025)',
  '0 10px 28px -6px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.025)',
  ...Array(20).fill('0 0 0 1px rgba(0,0,0,0.4)') as string[]
] as const;

// "Liquid glass" deep space theme (keeps export name to avoid ref changes)
export const darkAquaTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#00d8ff', light: '#4be9ff', dark: '#0096aa', contrastText: '#001e24' },
    secondary: { main: '#7753ff', light: '#9c7dff', dark: '#4b27c7' },
    info: { main: '#4bb8ff' },
    success: { main: '#00c27a' },
    error: { main: '#ff4d67' },
    warning: { main: '#ffb347' },
    background: {
      default: '#03060a', // near-black
      paper: 'rgba(16,26,40,0.55)'
    },
    divider: 'rgba(255,255,255,0.08)',
    text: {
      primary: '#e6f7ff',
      secondary: alpha('#e6f7ff', 0.55)
    }
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: 'Inter, "IBM Plex Sans", Roboto, system-ui, sans-serif',
    h6: { letterSpacing: 0.6, fontWeight: 600 },
    button: { textTransform: 'none', fontWeight: 500 }
  },
  shadows: customShadows as any,
  components: {
    MuiCssBaseline: {
      styleOverrides: () => ({
        body: {
          backgroundColor: '#03060a',
          backgroundImage: [
            'radial-gradient(circle at 20% 15%, rgba(0,200,255,0.09), rgba(0,0,0,0) 45%)',
            'radial-gradient(circle at 80% 75%, rgba(120,60,255,0.10), rgba(0,0,0,0) 50%)',
            'linear-gradient(135deg, #020409 0%, #040b14 45%, #020409 100%)'
          ].join(','),
          backgroundAttachment: 'fixed',
          overscrollBehavior: 'none',
          WebkitFontSmoothing: 'antialiased'
        },
        '.MuiDataGrid-root': {
          background: 'rgba(8,14,20,0.25)',
          border: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(10px) saturate(140%)',
          WebkitBackdropFilter: 'blur(10px) saturate(140%)'
        },
        '.MuiDataGrid-columnHeaders': {
          background: 'linear-gradient(90deg, rgba(16,28,40,0.65), rgba(10,18,26,0.55))',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)'
        },
        '.MuiDataGrid-row:nth-of-type(even) .MuiDataGrid-cell': {
          backgroundColor: 'rgba(255,255,255,0.015)'
        },
        '.MuiDataGrid-cell': { borderBottom: '1px solid rgba(255,255,255,0.04)' },
        '*::selection': { background: alpha('#00d8ff', 0.25) },
        '::-webkit-scrollbar': { width: 10, height: 10 },
        '::-webkit-scrollbar-track': { background: 'rgba(255,255,255,0.03)' },
        '::-webkit-scrollbar-thumb': {
            background: 'linear-gradient(180deg,#145566,#0a2a33)',
            border: '2px solid #03060a',
            borderRadius: 24
        },
        '::-webkit-scrollbar-thumb:hover': { background: 'linear-gradient(180deg,#1a6d80,#0d3642)' }
      })
    },
    MuiPaper: {
      styleOverrides: {
        root: () => ({
          background: 'linear-gradient(135deg, rgba(25,40,54,0.55) 0%, rgba(14,24,34,0.55) 55%)',
          backdropFilter: 'blur(14px) saturate(160%)',
          WebkitBackdropFilter: 'blur(14px) saturate(160%)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 4px 28px -6px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.02)'
        })
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, rgba(5,12,18,0.85) 0%, rgba(12,20,28,0.55) 55%, rgba(5,12,18,0.85))',
          backdropFilter: 'blur(18px) saturate(180%)',
          WebkitBackdropFilter: 'blur(18px) saturate(180%)',
          borderBottom: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 2px 20px -4px rgba(0,0,0,0.7)'
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(180deg, rgba(10,18,26,0.85), rgba(6,12,18,0.90))',
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
          borderRight: '1px solid rgba(255,255,255,0.08)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
          letterSpacing: 0.4,
          position: 'relative',
          overflow: 'hidden'
        },
        containedPrimary: {
          background: 'linear-gradient(135deg,#00d8ff,#0087ff)',
          boxShadow: '0 4px 16px -4px rgba(0,180,255,0.55), 0 0 0 1px rgba(0,216,255,0.25)',
          '&:hover': {
            background: 'linear-gradient(135deg,#34e4ff,#0096ff)',
            boxShadow: '0 4px 20px -4px rgba(0,160,255,0.65), 0 0 0 1px rgba(0,216,255,0.35)'
          }
        }
      }
    },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } } },
    MuiTooltip: { styleOverrides: { tooltip: { backdropFilter: 'blur(10px)', background: 'rgba(25,35,45,0.85)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 } } },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(255,255,255,0.06)' } } },
    MuiTextField: { styleOverrides: { root: { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } } } },
  // DataGrid customização via CssBaseline (classes globais)
  }
});
