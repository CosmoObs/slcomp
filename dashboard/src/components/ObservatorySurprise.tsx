import { Box, Dialog, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import photograph from '../../.extras/observatory.webp';

export const ObservatorySurprise = ({ open, onClose }: { open: boolean; onClose: () => void }) => (
  <Dialog open={open} onClose={onClose} maxWidth="md"
    PaperProps={{ 'aria-label': 'A star at the observatory', sx: { bgcolor: '#000000', maxHeight: '90vh', overflow: 'hidden' } }}>
    <IconButton aria-label="Close image" onClick={onClose} sx={{ position: 'absolute', top: 8, right: 8, zIndex: 1, bgcolor: 'rgba(0,0,0,.6)', color: '#fff' }}><CloseIcon /></IconButton>
    <Box component="img" src={photograph} alt="A visit to the telescope" sx={{ display: 'block', maxWidth: '100%', maxHeight: '90vh', objectFit: 'contain' }} />
  </Dialog>
);
