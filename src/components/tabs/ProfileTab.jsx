import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert, Grid, Divider, Chip, CircularProgress } from '@mui/material';
import { useAuth } from '../../context/AuthContext';

const api = async (path, opts = {}) => {
  const token = localStorage.getItem('ukulotrade_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers };
  const res = await fetch(path, { ...opts, headers });
  return res.json();
};

function StatCard({ label, value, color }) {
  return (
    <Paper sx={{ p: 2, bgcolor: '#1a1a1a', border: '1px solid #333', textAlign: 'center' }}>
      <Typography sx={{ color: '#666', fontSize: 10, letterSpacing: 1, mb: 0.5 }}>{label}</Typography>
      <Typography sx={{ color: color || '#e0e0e0', fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace' }}>{value}</Typography>
    </Paper>
  );
}

export default function ProfileTab() {
  const { user, setUser } = useAuth();
  const [profileStats, setProfileStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState(user?.name || '');
  const [nameMsg, setNameMsg] = useState({ type: '', text: '' });

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMsg, setPwMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    setLoading(true);
    api('/api/auth/profile-stats').then(data => {
      setProfileStats(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user?.name) setName(user.name);
  }, [user]);

  const handleUpdateName = async (e) => {
    e.preventDefault();
    setNameMsg({ type: '', text: '' });
    try {
      const data = await api('/api/auth/profile', { method: 'PUT', body: JSON.stringify({ name }) });
      if (data.error) { setNameMsg({ type: 'error', text: data.error }); return; }
      setUser(data);
      setNameMsg({ type: 'success', text: 'Nome atualizado com sucesso' });
    } catch {
      setNameMsg({ type: 'error', text: 'Erro ao atualizar nome' });
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPwMsg({ type: '', text: '' });
    if (newPassword !== confirmPassword) {
      setPwMsg({ type: 'error', text: 'As senhas nao coincidem' });
      return;
    }
    if (newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'Nova senha deve ter no minimo 6 caracteres' });
      return;
    }
    try {
      const data = await api('/api/auth/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (data.error) { setPwMsg({ type: 'error', text: data.error }); return; }
      setPwMsg({ type: 'success', text: 'Senha alterada com sucesso' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      setPwMsg({ type: 'error', text: 'Erro ao alterar senha' });
    }
  };

  const inputSx = {
    '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#333' }, '&:hover fieldset': { borderColor: '#44FF44' }, '&.Mui-focused fieldset': { borderColor: '#44FF44' } },
    '& .MuiInputLabel-root': { color: '#666' },
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress sx={{ color: '#44FF44' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2, maxWidth: 900 }}>
      <Typography variant="h6" sx={{ color: '#44FF44', mb: 3, fontWeight: 'bold' }}>Meu Perfil</Typography>

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, bgcolor: '#1a1a1a', border: '1px solid #333', textAlign: 'center' }}>
            <Box sx={{ width: 72, height: 72, borderRadius: '50%', bgcolor: 'rgba(68,255,68,0.15)', border: '2px solid rgba(68,255,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', mx: 'auto', mb: 2 }}>
              <Typography sx={{ color: '#44FF44', fontSize: 28, fontWeight: 'bold' }}>{user?.name?.[0]?.toUpperCase() || '?'}</Typography>
            </Box>
            <Typography sx={{ color: '#e0e0e0', fontSize: 18, fontWeight: 'bold', mb: 0.5 }}>{user?.name}</Typography>
            <Typography sx={{ color: '#888', fontSize: 13, mb: 1 }}>{user?.email}</Typography>
            <Chip label={user?.role === 'admin' ? 'Administrador' : 'Membro'} size="small"
              sx={{ bgcolor: user?.role === 'admin' ? 'rgba(255,170,0,0.15)' : 'rgba(68,255,68,0.1)', color: user?.role === 'admin' ? '#FFAA00' : '#44FF44', fontSize: 11, border: `1px solid ${user?.role === 'admin' ? 'rgba(255,170,0,0.3)' : 'rgba(68,255,68,0.2)'}` }} />
            <Typography sx={{ color: '#555', fontSize: 11, mt: 1.5, display: 'block' }}>
              Membro desde: {profileStats?.created_at?.slice(0, 10) || 'N/A'}
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            <Grid item xs={6}>
              <StatCard label="TOTAL TRADES" value={profileStats?.totalTrades || 0} color="#e0e0e0" />
            </Grid>
            <Grid item xs={6}>
              <StatCard label="P/L TOTAL" value={`$${profileStats?.totalProfit?.toFixed(2) || '0.00'}`} color={(profileStats?.totalProfit || 0) >= 0 ? '#44FF44' : '#FF4444'} />
            </Grid>
            <Grid item xs={6}>
              <StatCard label="WIN RATE" value={`${profileStats?.winRate || 0}%`} color="#4a9eff" />
            </Grid>
            <Grid item xs={6}>
              <StatCard label="ULTIMO TRADE" value={profileStats?.lastTrade?.slice(0, 10) || 'N/A'} color="#e0e0e0" />
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 2 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, bgcolor: '#1a1a1a', border: '1px solid #333' }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', fontSize: 14, color: '#44FF44' }}>Alterar Nome</Typography>
            {nameMsg.text && <Alert severity={nameMsg.type} sx={{ mb: 1.5 }}>{nameMsg.text}</Alert>}
            <Box component="form" onSubmit={handleUpdateName}>
              <TextField fullWidth size="small" label="Nome" value={name} onChange={e => setName(e.target.value)} required sx={{ mb: 1.5, ...inputSx }} />
              <Button type="submit" variant="contained" fullWidth sx={{ bgcolor: '#44FF44', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#33cc33' } }}>
                Salvar Nome
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, bgcolor: '#1a1a1a', border: '1px solid #333' }}>
            <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 'bold', fontSize: 14, color: '#FFAA00' }}>Alterar Senha</Typography>
            {pwMsg.text && <Alert severity={pwMsg.type} sx={{ mb: 1.5 }}>{pwMsg.text}</Alert>}
            <Box component="form" onSubmit={handleChangePassword}>
              <TextField fullWidth size="small" label="Senha Atual" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} required sx={{ mb: 1.5, ...inputSx }} />
              <TextField fullWidth size="small" label="Nova Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required sx={{ mb: 1.5, ...inputSx }} />
              <TextField fullWidth size="small" label="Confirmar Nova Senha" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required sx={{ mb: 1.5, ...inputSx }} />
              <Button type="submit" variant="contained" fullWidth sx={{ bgcolor: '#FFAA00', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#cc8800' } }}>
                Alterar Senha
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
