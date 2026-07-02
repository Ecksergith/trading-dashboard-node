import { useState } from 'react';
import { Box, Grid, Paper, Typography, List, ListItem, ListItemText, IconButton, TextField, Button, Chip, Divider, Snackbar, Alert } from '@mui/material';
import { useApp } from '../../context/AppContext';

export default function AssetsTab() {
  const { pairs, setPairs, accountInfo, apiPost, apiDelete, connected } = useApp();
  const [newPair, setNewPair] = useState('');
  const [savedOpen, setSavedOpen] = useState(false);

  const addPair = async () => {
    if (!newPair.trim()) return;
    const result = await apiPost('/api/pairs', { pair: newPair.trim() });
    if (result) setPairs(result);
    setNewPair('');
    setSavedOpen(true);
  };

  const removePair = async (pair) => {
    const result = await apiDelete(`/api/pairs/${pair}`);
    if (result) setPairs(result);
  };

  return (
    <>
    <Grid container spacing={1}>
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Pares de Trading</Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField size="small" placeholder="EURUSD ou Volatility 10 Index" value={newPair} onChange={e => setNewPair(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addPair()}
              InputProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} sx={{ flex: 1 }} />
            <Button variant="contained" size="small"
              onClick={addPair} sx={{ bgcolor: '#44FF44', color: '#000', '&:hover': { bgcolor: '#33cc33' }, fontSize: 11 }}>
              + Adicionar
            </Button>
          </Box>

          <List dense sx={{ maxHeight: 350, overflow: 'auto' }}>
            {pairs.map(p => (
              <ListItem key={p} secondaryAction={
                <IconButton edge="end" size="small" onClick={() => removePair(p)} sx={{ color: '#FF4444', fontSize: 14 }}>
                  X
                </IconButton>
              } sx={{ bgcolor: '#2a2a2a', mb: 0.5, borderRadius: 1 }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#44FF44', mr: 1 }} />
                <ListItemText primary={p} primaryTypographyProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} />
              </ListItem>
            ))}
          </List>
        </Paper>
      </Grid>

      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Servidor & Conexao</Typography>

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: connected ? '#44FF44' : '#FF4444' }} />
              <Typography sx={{ color: connected ? '#44FF44' : '#FF4444', fontSize: 12 }}>
                {connected ? 'Conectado ao MT5' : 'Desconectado'}
              </Typography>
            </Box>

            <Divider sx={{ bgcolor: '#333', my: 1 }} />

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
              <Box sx={{ bgcolor: '#2a2a2a', p: 1, borderRadius: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 10 }}>Servidor</Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: 12 }}>{accountInfo?.server || '-'}</Typography>
              </Box>
              <Box sx={{ bgcolor: '#2a2a2a', p: 1, borderRadius: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 10 }}>Login</Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: 12 }}>{accountInfo?.login || '-'}</Typography>
              </Box>
              <Box sx={{ bgcolor: '#2a2a2a', p: 1, borderRadius: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 10 }}>Balance</Typography>
                <Typography sx={{ color: '#44FF44', fontSize: 12 }}>${(accountInfo?.balance || 0).toFixed(2)}</Typography>
              </Box>
              <Box sx={{ bgcolor: '#2a2a2a', p: 1, borderRadius: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 10 }}>Leverage</Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: 12 }}>1:{accountInfo?.leverage || 0}</Typography>
              </Box>
              <Box sx={{ bgcolor: '#2a2a2a', p: 1, borderRadius: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 10 }}>Equity</Typography>
                <Typography sx={{ color: '#4a9eff', fontSize: 12 }}>${(accountInfo?.equity || 0).toFixed(2)}</Typography>
              </Box>
              <Box sx={{ bgcolor: '#2a2a2a', p: 1, borderRadius: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 10 }}>Empresa</Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: 12 }}>{accountInfo?.company || '-'}</Typography>
              </Box>
            </Box>
          </Box>

          <Divider sx={{ bgcolor: '#333', my: 1 }} />

          <Typography variant="caption" sx={{ color: '#FFAA00', fontWeight: 'bold', display: 'block', mb: 1 }}>MT5 Bridge</Typography>
          <Typography sx={{ color: '#888', fontSize: 11, mb: 1 }}>
            O bridge conecta o dashboard ao MetaTrader 5 via HTTP. Execute o bridge.py para habilitar a conexao.
          </Typography>
          <Chip label="Porta: 5000" size="small" sx={{ bgcolor: '#2a2a2a', fontSize: 11 }} />
        </Paper>
      </Grid>
    </Grid>

      <Snackbar open={savedOpen} autoHideDuration={2000} onClose={() => setSavedOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled" sx={{ width: '100%', bgcolor: '#44FF44', color: '#000', fontWeight: 'bold' }}>
          Dados salvos com sucesso!
        </Alert>
      </Snackbar>
    </>
  );
}
