import { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, TextField, Button, Switch, FormControlLabel, IconButton, Divider, Chip, Snackbar, Alert, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle, DialogContent, DialogActions, LinearProgress } from '@mui/material';
import { useApp } from '../../context/AppContext';

function AccountDialog({ open, onClose, onSave, editAccount }) {
  const [form, setForm] = useState({
    name: '',
    bridgeUrl: 'http://localhost:5000',
    enabled: true,
    riskSettings: { auto_trading: false },
  });

  useEffect(() => {
    if (editAccount) {
      setForm({
        name: editAccount.name || '',
        bridgeUrl: editAccount.bridgeUrl || 'http://localhost:5000',
        enabled: editAccount.enabled !== false,
        riskSettings: editAccount.riskSettings || { auto_trading: false },
      });
    } else {
      setForm({ name: '', bridgeUrl: 'http://localhost:5000', enabled: true, riskSettings: { auto_trading: false } });
    }
  }, [editAccount, open]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave(form);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ bgcolor: '#1a1a1a', color: '#44FF44', fontSize: 14 }}>
        {editAccount ? 'Editar Conta' : 'Nova Conta'}
      </DialogTitle>
      <DialogContent sx={{ bgcolor: '#1a1a1a' }}>
        <TextField size="small" label="Nome da Conta" fullWidth sx={{ mt: 1, mb: 1 }}
          value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
          InputProps={{ sx: { color: '#e0e0e0' } }} InputLabelProps={{ sx: { color: '#888' } }} />

        <TextField size="small" label="URL Bridge MT5" fullWidth sx={{ mb: 1 }}
          value={form.bridgeUrl} onChange={e => setForm(prev => ({ ...prev, bridgeUrl: e.target.value }))}
          placeholder="http://localhost:5000"
          InputProps={{ sx: { color: '#e0e0e0' } }} InputLabelProps={{ sx: { color: '#888' } }} />

        <FormControlLabel control={<Switch checked={form.enabled} size="small"
          onChange={e => setForm(prev => ({ ...prev, enabled: e.target.checked }))} />}
          label={<Typography sx={{ fontSize: 12, color: '#888' }}>Conta Ativa</Typography>} />

        <Divider sx={{ bgcolor: '#333', my: 1 }} />

        <Typography sx={{ color: '#FFAA00', fontSize: 11, fontWeight: 'bold', mb: 0.5 }}>
          Auto-trading para esta conta
        </Typography>
        <FormControlLabel control={<Switch checked={form.riskSettings?.auto_trading || false} size="small"
          onChange={e => setForm(prev => ({
            ...prev,
            riskSettings: { ...prev.riskSettings, auto_trading: e.target.checked }
          }))} />}
          label={<Typography sx={{ fontSize: 12, color: '#888' }}>Ativar Auto-trading nesta conta</Typography>} />
      </DialogContent>
      <DialogActions sx={{ bgcolor: '#1a1a1a' }}>
        <Button onClick={onClose} sx={{ color: '#888' }}>Cancelar</Button>
        <Button onClick={handleSave} variant="contained" sx={{ bgcolor: '#44FF44', color: '#000' }}>
          {editAccount ? 'Salvar' : 'Criar'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function AccountCard({ account, onEdit, onDelete, onRefresh, onTrade }) {
  const [expanded, setExpanded] = useState(false);
  const ai = account.accountInfo || {};
  const positions = account.openPositions || [];

  return (
    <Paper sx={{
      p: 1.5, bgcolor: '#1a1a1a',
      border: `1px solid ${account.connected ? 'rgba(68,255,68,0.3)' : 'rgba(255,68,68,0.3)'}`,
    }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: account.connected ? '#44FF44' : '#FF4444',
            boxShadow: account.connected ? '0 0 8px #44FF44' : '0 0 8px #FF4444' }} />
          <Typography sx={{ color: '#e0e0e0', fontSize: 13, fontWeight: 'bold' }}>{account.name}</Typography>
          {!account.enabled && <Chip size="small" label="Inativa" sx={{ bgcolor: '#333', color: '#888', fontSize: 9 }} />}
          {account.riskSettings?.auto_trading && (
            <Chip size="small" label="AUTO" sx={{ bgcolor: 'rgba(68,255,68,0.15)', color: '#44FF44', fontSize: 9, fontWeight: 'bold' }} />
          )}
        </Box>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" onClick={() => onRefresh(account.id)} sx={{ color: '#4a9eff', fontSize: 14 }}>↻</IconButton>
          <IconButton size="small" onClick={() => onEdit(account)} sx={{ color: '#FFAA00', fontSize: 14 }}>✎</IconButton>
          {account.id !== 'default' && (
            <IconButton size="small" onClick={() => onDelete(account.id)} sx={{ color: '#FF4444', fontSize: 14 }}>✕</IconButton>
          )}
        </Box>
      </Box>

      <Typography sx={{ color: '#888', fontSize: 10, mb: 1 }}>{account.bridgeUrl}</Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, mb: 1 }}>
        <Box sx={{ bgcolor: '#2a2a2a', p: 0.75, borderRadius: 0.5, textAlign: 'center' }}>
          <Typography sx={{ color: '#888', fontSize: 9 }}>Balance</Typography>
          <Typography sx={{ color: '#44FF44', fontSize: 13, fontWeight: 'bold' }}>${(ai.balance || 0).toFixed(2)}</Typography>
        </Box>
        <Box sx={{ bgcolor: '#2a2a2a', p: 0.75, borderRadius: 0.5, textAlign: 'center' }}>
          <Typography sx={{ color: '#888', fontSize: 9 }}>Equity</Typography>
          <Typography sx={{ color: '#4a9eff', fontSize: 13, fontWeight: 'bold' }}>${(ai.equity || 0).toFixed(2)}</Typography>
        </Box>
        <Box sx={{ bgcolor: '#2a2a2a', p: 0.75, borderRadius: 0.5, textAlign: 'center' }}>
          <Typography sx={{ color: '#888', fontSize: 9 }}>Profit</Typography>
          <Typography sx={{ color: (ai.profit || 0) >= 0 ? '#44FF44' : '#FF4444', fontSize: 13, fontWeight: 'bold' }}>${(ai.profit || 0).toFixed(2)}</Typography>
        </Box>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, mb: 0.5, flexWrap: 'wrap' }}>
        <Chip size="small" label={`Server: ${ai.server || '-'}`} sx={{ bgcolor: '#2a2a2a', fontSize: 9, height: 18 }} />
        <Chip size="small" label={`Login: ${ai.login || '-'}`} sx={{ bgcolor: '#2a2a2a', fontSize: 9, height: 18 }} />
        <Chip size="small" label={`Leverage: 1:${ai.leverage || 0}`} sx={{ bgcolor: '#2a2a2a', fontSize: 9, height: 18 }} />
      </Box>

      {positions.length > 0 && (
        <Box sx={{ mt: 0.5 }}>
          <Typography sx={{ color: '#FFAA00', fontSize: 10, mb: 0.25 }}>Posicoes ({positions.length})</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
            {positions.map((p, i) => (
              <Chip key={i} size="small"
                label={`${p.symbol} ${p.type === 0 ? 'BUY' : 'SELL'} ${p.volume} P/L:$${(p.profit || 0).toFixed(2)}`}
                sx={{
                  bgcolor: p.profit >= 0 ? 'rgba(68,255,68,0.1)' : 'rgba(255,68,68,0.1)',
                  color: p.profit >= 0 ? '#44FF44' : '#FF4444',
                  fontSize: 9, height: 18,
                }} />
            ))}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

export default function AccountsTab() {
  const { accounts, setAccounts, accountsSummary, setAccountsSummary, apiGet, apiPost, apiDelete, addLog } = useApp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editAccount, setEditAccount] = useState(null);
  const [savedOpen, setSavedOpen] = useState(false);
  const [multiAutoRunning, setMultiAutoRunning] = useState(false);

  useEffect(() => {
    fetchAccounts();
    fetchSummary();
    const t1 = setInterval(fetchAccounts, 10000);
    const t2 = setInterval(fetchSummary, 15000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);

  const fetchAccounts = async () => {
    const data = await apiGet('/api/accounts');
    if (data) setAccounts(data);
  };

  const fetchSummary = async () => {
    const data = await apiGet('/api/accounts/consolidated');
    if (data) setAccountsSummary(data);
  };

  const handleCreate = async (form) => {
    const result = await apiPost('/api/accounts', form);
    if (result) {
      setAccounts(prev => [...prev, result]);
      addLog('info', `Conta "${form.name}" criada com sucesso`);
      setSavedOpen(true);
    }
  };

  const handleUpdate = async (form) => {
    if (!editAccount) return;
    const result = await apiPost(`/api/accounts/${editAccount.id}`, form);
    if (result) {
      setAccounts(prev => prev.map(a => a.id === editAccount.id ? { ...a, ...form } : a));
      addLog('info', `Conta "${form.name}" atualizada`);
      setSavedOpen(true);
    }
  };

  const handleDelete = async (id) => {
    const result = await apiDelete(`/api/accounts/${id}`);
    if (result?.ok) {
      setAccounts(prev => prev.filter(a => a.id !== id));
      addLog('warning', `Conta removida`);
    }
  };

  const handleRefresh = async (id) => {
    await apiPost(`/api/accounts/${id}/refresh`);
    fetchAccounts();
  };

  const toggleMultiAutoTrader = async () => {
    if (multiAutoRunning) {
      await apiPost('/api/multi-auto-trader/stop');
      setMultiAutoRunning(false);
      addLog('info', 'Multi auto-trader parado');
    } else {
      await apiPost('/api/multi-auto-trader/start', { interval: 30000 });
      setMultiAutoRunning(true);
      addLog('info', 'Multi auto-trader iniciado');
    }
    setSavedOpen(true);
  };

  const s = accountsSummary || {};
  const activeAccounts = (accounts || []).filter(a => a.enabled);

  return (
    <>
      <Grid container spacing={1}>
        {/* Summary Cards */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
            <Typography sx={{ color: '#888', fontSize: 11 }}>Contas</Typography>
            <Typography sx={{ color: '#4a9eff', fontSize: 22, fontWeight: 'bold' }}>
              {s.connected || 0}/{s.accounts || 0}
            </Typography>
            <Typography sx={{ color: '#888', fontSize: 10 }}>Conectadas</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
            <Typography sx={{ color: '#888', fontSize: 11 }}>Balance Total</Typography>
            <Typography sx={{ color: '#44FF44', fontSize: 22, fontWeight: 'bold' }}>${(s.totalBalance || 0).toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
            <Typography sx={{ color: '#888', fontSize: 11 }}>Equity Total</Typography>
            <Typography sx={{ color: '#4a9eff', fontSize: 22, fontWeight: 'bold' }}>${(s.totalEquity || 0).toFixed(2)}</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
            <Typography sx={{ color: '#888', fontSize: 11 }}>Win Rate</Typography>
            <Typography sx={{ color: '#FFAA00', fontSize: 22, fontWeight: 'bold' }}>{(s.winRate || 0).toFixed(1)}%</Typography>
            <LinearProgress variant="determinate" value={s.winRate || 0}
              sx={{ mt: 0.5, height: 4, borderRadius: 2, bgcolor: '#333', '& .MuiLinearProgress-bar': { bgcolor: '#FFAA00', borderRadius: 2 } }} />
          </Paper>
        </Grid>

        {/* Multi Auto-Trader Control */}
        <Grid item xs={12}>
          <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', display: 'flex', alignItems: 'center', gap: 2, justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', fontSize: 13 }}>
                Multi Auto-Trader
              </Typography>
              <Chip size="small" label={multiAutoRunning ? 'RODANDO' : 'PARADO'}
                sx={{
                  bgcolor: multiAutoRunning ? 'rgba(68,255,68,0.15)' : 'rgba(255,68,68,0.15)',
                  color: multiAutoRunning ? '#44FF44' : '#FF4444',
                  fontSize: 10, fontWeight: 'bold',
                }} />
              <Typography sx={{ color: '#888', fontSize: 11 }}>
                {activeAccounts.length} conta(s) ativa(s)
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button variant="contained" size="small" onClick={toggleMultiAutoTrader}
                sx={{
                  bgcolor: multiAutoRunning ? '#FF4444' : '#44FF44',
                  color: multiAutoRunning ? '#fff' : '#000',
                  fontSize: 11,
                }}>
                {multiAutoRunning ? 'Parar' : 'Iniciar'}
              </Button>
              <Button variant="outlined" size="small" onClick={() => { setEditAccount(null); setDialogOpen(true); }}
                sx={{ color: '#44FF44', borderColor: '#44FF44', fontSize: 11 }}>
                + Nova Conta
              </Button>
            </Box>
          </Paper>
        </Grid>

        {/* Account Cards */}
        {(accounts || []).map(account => (
          <Grid item xs={12} md={6} key={account.id}>
            <AccountCard
              account={account}
              onEdit={(acc) => { setEditAccount(acc); setDialogOpen(true); }}
              onDelete={handleDelete}
              onRefresh={handleRefresh}
            />
          </Grid>
        ))}
      </Grid>

      <AccountDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditAccount(null); }}
        onSave={editAccount ? handleUpdate : handleCreate}
        editAccount={editAccount}
      />

      <Snackbar open={savedOpen} autoHideDuration={2000} onClose={() => setSavedOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled" sx={{ width: '100%', bgcolor: '#44FF44', color: '#000', fontWeight: 'bold' }}>
          Operacao realizada com sucesso!
        </Alert>
      </Snackbar>
    </>
  );
}
