import { createTheme, alpha } from '@mui/material/styles';

export const catalogTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#8ed4be', light: '#b6e8d8', dark: '#579f88', contrastText: '#10251f' },
    secondary: { main: '#a9b8e8' },
    background: { default: '#000000', paper: '#000000' },
    text: { primary: '#edf0f4', secondary: '#9ba6b5' },
    divider: '#2b333e',
    error: { main: '#f19191' },
    action: { hover: 'rgba(255,255,255,0.04)', selected: 'rgba(142,212,190,0.10)' }
  },
  shape: { borderRadius: 4 },
  typography: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: { fontSize: '1.85rem', fontWeight: 600, letterSpacing: '-0.045em', lineHeight: 1.3 },
    h5: { fontSize: '1.3rem', fontWeight: 600, letterSpacing: '-0.025em' },
    h6: { fontSize: '1.05rem', fontWeight: 600, letterSpacing: '-0.015em' },
    body2: { fontSize: '0.875rem', lineHeight: 1.6 },
    overline: { fontSize: '0.65rem', fontWeight: 600, letterSpacing: '0.14em', lineHeight: 2.5 },
    button: { textTransform: 'none', fontWeight: 600, letterSpacing: 0 }
  },
  components: {
    MuiCssBaseline: { styleOverrides: {
      body: { WebkitFontSmoothing: 'antialiased' },
      '*': { scrollbarWidth: 'thin', scrollbarColor: '#3c4756 transparent' },
      '*::selection': { background: alpha('#8ed4be', 0.25) },
      ':focus-visible': { outline: '2px solid #8ed4be', outlineOffset: 3 }
    } },
    MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: {
      backgroundImage: 'none', backgroundColor: 'transparent', border: 0, boxShadow: 'none'
    } } },
    MuiAppBar: { styleOverrides: { root: {
      backgroundColor: '#000000', color: '#edf0f4', border: 0, borderBottom: '1px solid #2b333e', boxShadow: 'none'
    } } },
    MuiDrawer: { styleOverrides: { paper: { backgroundColor: '#191e25', backgroundImage: 'none' } } },
    MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: {
      root: { borderRadius: 4, padding: '8px 16px' },
      outlined: { borderColor: '#3c4756', color: '#edf0f4', '&:hover': { borderColor: '#8ed4be', backgroundColor: 'rgba(142,212,190,0.05)' } }
    } },
    MuiOutlinedInput: { styleOverrides: { root: {
      borderRadius: 4, backgroundColor: 'transparent',
      '& .MuiOutlinedInput-notchedOutline': { borderColor: '#3c4756' }
    }, input: { padding: '13px 14px' } } },
    MuiTabs: { styleOverrides: { indicator: { height: 2 }, root: { borderBottom: '1px solid #2b333e' } } },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 52, padding: '12px 16px' } } },
    MuiChip: { styleOverrides: { root: { borderRadius: 3, fontSize: 12 } } },
    MuiTooltip: { styleOverrides: { tooltip: { backgroundColor: '#303a47', fontSize: 12 } } },
    MuiTableCell: { styleOverrides: { root: { borderColor: '#2b333e' } } }
  }
});
