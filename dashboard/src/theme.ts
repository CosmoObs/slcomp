import { createTheme, alpha } from '@mui/material/styles';

const customShadows = [
  'none',
  '0 2px 4px -2px rgba(0,0,0,0.6)',
  '0 4px 12px -2px rgba(0,0,0,0.65)',
  '0 6px 18px -4px rgba(0,0,0,0.65)',
  '0 10px 28px -6px rgba(0,0,0,0.7)',
  ...Array(20).fill('0 0 0 1px rgba(0,0,0,0.4)') as string[]
] as const;

// Solid (non-translucent) deep space theme — keeps the dark/aqua look but
// avoids backdrop-filter / saturate filters everywhere, which were the main
// source of GPU/RAM pressure and laggy scroll.
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
      default: '#03060a',
      paper: '#101a28'
    },
    divider: 'rgba(255,255,255,0.08)',
    text: {
      primary: '#e6f7ff',
      secondary: alpha('#e6f7ff', 0.6)
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
          // Single static gradient — no fixed attachment, no radial overlays.
          backgroundImage: 'linear-gradient(135deg, #04080d 0%, #061018 50%, #04080d 100%)',
          overscrollBehavior: 'none',
          WebkitFontSmoothing: 'antialiased'
        },
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
          background: 'linear-gradient(135deg, #14222e 0%, #0d1820 60%, #0a141c 100%)',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 4px 28px -10px rgba(0,0,0,0.7)'
        })
      }
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: 'linear-gradient(90deg, #06101a 0%, #0a1622 55%, #06101a 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          boxShadow: '0 2px 16px -6px rgba(0,0,0,0.7)'
        }
      }
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: 'linear-gradient(180deg, #0c1620 0%, #08111a 100%)',
          borderRight: '1px solid rgba(255,255,255,0.07)'
        }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          fontWeight: 500,
          letterSpacing: 0.4
        },
        containedPrimary: {
          background: 'linear-gradient(135deg,#00d8ff,#0087ff)',
          boxShadow: '0 4px 12px -4px rgba(0,180,255,0.55)',
          '&:hover': {
            background: 'linear-gradient(135deg,#34e4ff,#0096ff)'
          }
        }
      }
    },
    MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: 3 } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } } },
    MuiTooltip: { styleOverrides: { tooltip: { background: '#1a2530', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12 } } },
    MuiDivider: { styleOverrides: { root: { borderColor: 'rgba(255,255,255,0.06)' } } },
    MuiTextField: { styleOverrides: { root: { '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.15)' } } } }
  }
});
