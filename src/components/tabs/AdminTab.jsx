import { useState, useEffect } from 'react';
import { Box, Typography, TextField, Button, Paper, Alert, Grid, Chip, Divider, Tooltip, Drawer, IconButton, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TableSortLabel, Dialog, DialogTitle, DialogContent, DialogActions, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import { useAuth } from '../../context/AuthContext';

const api = async (path, opts = {}) => {
  const token = localStorage.getItem('ukulotrade_token');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...opts.headers };
  const res = await fetch(path, { ...opts, headers });
  return res.json();
};

function StatCard({ label, value, color, icon }) {
  return (
    <Paper sx={{ p: 2, bgcolor: '#1a1a1a', border: '1px solid #333', textAlign: 'center' }}>
      <Typography sx={{ color: '#666', fontSize: 10, letterSpacing: 1, mb: 0.5 }}>{icon} {label}</Typography>
      <Typography sx={{ color: color || '#e0e0e0', fontSize: 24, fontWeight: 'bold', fontFamily: 'monospace' }}>{value}</Typography>
    </Paper>
  );
}

const inputSx = {
  '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#333' }, '&:hover fieldset': { borderColor: '#44FF44' }, '&.Mui-focused fieldset': { borderColor: '#44FF44' } },
  '& .MuiInputLabel-root': { color: '#666' },
};

export default function AdminTab() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [newMemberOpen, setNewMemberOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [drawerTab, setDrawerTab] = useState(0);
  const [drawerUserDetail, setDrawerUserDetail] = useState(null);
  const [drawerTrades, setDrawerTrades] = useState([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [resetLearningConfirm, setResetLearningConfirm] = useState(false);
  const [resettingLearning, setResettingLearning] = useState(false);

  const fetchData = async () => {
    try {
      const [u, s] = await Promise.all([api('/api/admin/users'), api('/api/admin/stats')]);
      setUsers(Array.isArray(u) ? u : []);
      setStats(s);
    } catch {}
  };

  useEffect(() => { fetchData(); }, []);

  const showMsg = (msg, type) => {
    if (type === 'error') setError(msg); else setSuccess(msg);
    setTimeout(() => { setError(''); setSuccess(''); }, 3000);
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const data = await api('/api/admin/users', { method: 'POST', body: JSON.stringify({ name: newName, email: newEmail, password: newPassword }) });
      if (data.error) { showMsg(data.error, 'error'); return; }
      showMsg(`Membro ${data.email} criado com sucesso`, 'success');
      setNewName(''); setNewEmail(''); setNewPassword('');
      setNewMemberOpen(false);
      fetchData();
    } catch { showMsg('Erro ao criar membro', 'error'); }
  };

  const handleToggleStatus = async (userId, currentStatus) => {
    const newStatus = currentStatus === 'active' ? 'suspended' : 'active';
    const action = newStatus === 'suspended' ? 'suspender' : 'ativar';
    if (!confirm(`${action.charAt(0).toUpperCase() + action.slice(1)} este membro?`)) return;
    try {
      const data = await api(`/api/admin/users/${userId}/status`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
      if (data.ok) { showMsg(`Membro ${action} com sucesso`, 'success'); fetchData(); }
      else showMsg(data.error, 'error');
    } catch { showMsg(`Erro ao ${action} membro`, 'error'); }
  };

  const handleToggleRole = async (userId, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Alterar papel para ${newRole}?`)) return;
    try {
      const data = await api(`/api/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role: newRole }) });
      if (data.ok) { showMsg('Papel alterado', 'success'); fetchData(); if (drawerUserDetail?.id === userId) openDrawer(userId); }
      else showMsg(data.error, 'error');
    } catch { showMsg('Erro ao alterar papel', 'error'); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      const data = await api(`/api/admin/users/${deleteTarget.id}`, { method: 'DELETE' });
      if (data.ok) { showMsg(`${deleteTarget.name} excluido com sucesso`, 'success'); setDrawerOpen(false); setDeleteConfirmOpen(false); setDeleteTarget(null); fetchData(); }
      else showMsg(data.error, 'error');
    } catch { showMsg('Erro ao excluir', 'error'); }
  };

  const openDeleteConfirm = (u) => {
    setDeleteTarget(u);
    setDeleteConfirmOpen(true);
  };

  const handleResetLearning = async () => {
    setResettingLearning(true);
    try {
      const data = await api('/api/llm/self-improve/reset', { method: 'POST' });
      if (data.ok) {
        showMsg('Aprendizado do LLM resetado com sucesso', 'success');
        setResetLearningConfirm(false);
      } else {
        showMsg(data.error || 'Erro ao resetar aprendizado', 'error');
      }
    } catch {
      showMsg('Erro ao resetar aprendizado', 'error');
    }
    setResettingLearning(false);
  };

  const openDrawer = async (userId, startTab = 0) => {
    try {
      const [detail, trades] = await Promise.all([
        api(`/api/admin/users/${userId}`),
        api(`/api/admin/users/${userId}/trades?limit=100`),
      ]);
      setDrawerUserDetail(detail);
      setDrawerTrades(Array.isArray(trades) ? trades : []);
      setEditName(detail.name || '');
      setEditEmail(detail.email || '');
      setResetPassword('');
      setDrawerTab(startTab);
      setDrawerOpen(true);
    } catch { showMsg('Erro ao carregar detalhes', 'error'); }
  };

  const handleUpdateUser = async () => {
    if (!drawerUserDetail) return;
    try {
      const data = await api(`/api/admin/users/${drawerUserDetail.id}`, { method: 'PUT', body: JSON.stringify({ name: editName, email: editEmail }) });
      if (data.error) { showMsg(data.error, 'error'); return; }
      showMsg('Perfil atualizado', 'success');
      fetchData();
      openDrawer(drawerUserDetail.id);
    } catch { showMsg('Erro ao atualizar', 'error'); }
  };

  const handleResetPassword = async () => {
    if (!drawerUserDetail) return;
    if (resetPassword.length < 6) { showMsg('Senha deve ter no minimo 6 caracteres', 'error'); return; }
    try {
      const data = await api(`/api/admin/users/${drawerUserDetail.id}/password`, { method: 'PUT', body: JSON.stringify({ newPassword: resetPassword }) });
      if (data.error) { showMsg(data.error, 'error'); return; }
      showMsg('Senha resetada com sucesso', 'success');
      setResetPassword('');
    } catch { showMsg('Erro ao resetar senha', 'error'); }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'active' && (u.status === 'active' || !u.status)) ||
      (statusFilter === 'suspended' && u.status === 'suspended');
    return matchesSearch && matchesStatus;
  }).sort((a, b) => {
    let aVal = a[sortBy] ?? '';
    let bVal = b[sortBy] ?? '';
    if (sortBy === 'name' || sortBy === 'email') { aVal = String(aVal).toLowerCase(); bVal = String(bVal).toLowerCase(); }
    if (sortBy === 'totalTrades' || sortBy === 'totalProfit' || sortBy === 'balance') { aVal = Number(aVal) || 0; bVal = Number(bVal) || 0; }
    if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const handleSort = (field) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const cellSx = { borderBottom: '1px solid #222', py: 1 };
  const headSx = { color: '#888', fontSize: 11, borderBottom: '1px solid #333', fontWeight: 'bold' };
  const sortSx = { color: '#888', '&.MuiTableSortLabel-root.Mui-active': { color: '#44FF44' }, '&.MuiTableSortLabel-root.Mui-active .MuiTableSortLabel-icon': { color: '#44FF44' } };

  return (
    <Box sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h6" sx={{ color: '#44FF44', fontWeight: 'bold' }}>Gestao de Membros</Typography>
        <Button variant="contained" onClick={() => setNewMemberOpen(true)} sx={{ bgcolor: '#44FF44', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#33cc33' } }}>
          + Novo Membro
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 1 }}>{success}</Alert>}

      {stats && (
        <Grid container spacing={1.5} sx={{ mb: 3 }}>
          <Grid item xs={6} sm={3} md={2}><StatCard label="TOTAL" value={stats.totalUsers} color="#44FF44" icon="👥" /></Grid>
          <Grid item xs={6} sm={3} md={2}><StatCard label="ATIVOS" value={stats.activeUsers} color="#44FF44" icon="✅" /></Grid>
          <Grid item xs={6} sm={3} md={2}><StatCard label="SUSPENSOS" value={stats.suspendedUsers} color="#FF4444" icon="🚫" /></Grid>
          <Grid item xs={6} sm={3} md={2}><StatCard label="ADMINS" value={stats.admins} color="#FFAA00" icon="👑" /></Grid>
          <Grid item xs={6} sm={3} md={2}><StatCard label="NOVOS 7D" value={stats.newThisWeek} color="#4a9eff" icon="📈" /></Grid>
          <Grid item xs={6} sm={3} md={2}><StatCard label="NOVOS 30D" value={stats.newThisMonth} color="#4a9eff" icon="📊" /></Grid>
          <Grid item xs={6} sm={3} md={3}><StatCard label="TOTAL TRADES" value={stats.totalTrades} color="#e0e0e0" icon="💹" /></Grid>
          <Grid item xs={6} sm={3} md={3}><StatCard label="P/L TOTAL" value={`$${stats.totalProfit}`} color={parseFloat(stats.totalProfit) >= 0 ? '#44FF44' : '#FF4444'} icon="💰" /></Grid>
        </Grid>
      )}

      <Paper sx={{ p: 2, bgcolor: '#1a1a1a', border: '1px solid #333', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box>
            <Typography sx={{ color: '#FFAA00', fontSize: 13, fontWeight: 'bold' }}>Aprendizado do LLM</Typography>
            <Typography sx={{ color: '#666', fontSize: 11, mt: 0.5 }}>Reseta todo o historico de aprendizado: acuracia, threshold adaptativo, erros e performance por par/estrategia.</Typography>
          </Box>
          <Button variant="outlined" onClick={() => setResetLearningConfirm(true)} sx={{ borderColor: 'rgba(255,68,68,0.5)', color: '#FF4444', fontSize: 11, textTransform: 'none', '&:hover': { borderColor: '#FF4444', bgcolor: 'rgba(255,68,68,0.1)' } }}>
            Resetar Aprendizado
          </Button>
        </Box>
      </Paper>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 'bold', fontSize: 14 }}>Membros ({filteredUsers.length})</Typography>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 130 }}>
            <InputLabel sx={{ color: '#666' }}>Status</InputLabel>
            <Select value={statusFilter} label="Status" onChange={e => setStatusFilter(e.target.value)}
              sx={{ color: '#fff', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#333' }, '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#44FF44' }, '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#44FF44' } }}
              MenuProps={{ PaperProps: { sx: { bgcolor: '#1e1e1e', border: '1px solid #333' } } }}>
              <MenuItem value="all">Todos</MenuItem>
              <MenuItem value="active">Ativos</MenuItem>
              <MenuItem value="suspended">Suspensos</MenuItem>
            </Select>
          </FormControl>
          <TextField size="small" placeholder="Buscar membro..." value={search} onChange={e => setSearch(e.target.value)} sx={{ width: 220, ...inputSx }} />
        </Box>
      </Box>

      <TableContainer component={Paper} sx={{ bgcolor: '#1a1a1a', border: '1px solid #333' }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={headSx}></TableCell>
              <TableCell sx={headSx}>
                <TableSortLabel active={sortBy === 'name'} direction={sortBy === 'name' ? sortDir : 'asc'} onClick={() => handleSort('name')} sx={sortSx}>Nome</TableSortLabel>
              </TableCell>
              <TableCell sx={headSx}>
                <TableSortLabel active={sortBy === 'email'} direction={sortBy === 'email' ? sortDir : 'asc'} onClick={() => handleSort('email')} sx={sortSx}>Email</TableSortLabel>
              </TableCell>
              <TableCell sx={headSx}>Papel</TableCell>
              <TableCell sx={headSx}>Status</TableCell>
              <TableCell sx={headSx}>
                <TableSortLabel active={sortBy === 'balance'} direction={sortBy === 'balance' ? sortDir : 'asc'} onClick={() => handleSort('balance')} sx={sortSx}>Saldo</TableSortLabel>
              </TableCell>
              <TableCell sx={headSx}>
                <TableSortLabel active={sortBy === 'totalTrades'} direction={sortBy === 'totalTrades' ? sortDir : 'asc'} onClick={() => handleSort('totalTrades')} sx={sortSx}>Trades</TableSortLabel>
              </TableCell>
              <TableCell sx={headSx}>
                <TableSortLabel active={sortBy === 'totalProfit'} direction={sortBy === 'totalProfit' ? sortDir : 'asc'} onClick={() => handleSort('totalProfit')} sx={sortSx}>P/L</TableSortLabel>
              </TableCell>
              <TableCell sx={headSx}>
                <TableSortLabel active={sortBy === 'created_at'} direction={sortBy === 'created_at' ? sortDir : 'asc'} onClick={() => handleSort('created_at')} sx={sortSx}>Criado</TableSortLabel>
              </TableCell>
              <TableCell sx={headSx}>Acoes</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredUsers.map((u) => {
              const isActive = u.status === 'active' || !u.status;
              const isAdmin = u.role === 'admin';
              return (
                <TableRow key={u.id} hover sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'rgba(68,255,68,0.03)' } }} onClick={() => openDrawer(u.id, 3)}>
                  <TableCell sx={cellSx} onClick={e => e.stopPropagation()}>
                    <Box sx={{ width: 32, height: 32, borderRadius: '50%', bgcolor: isActive ? 'rgba(68,255,68,0.15)' : 'rgba(255,68,68,0.15)', border: `1px solid ${isActive ? 'rgba(68,255,68,0.3)' : 'rgba(255,68,68,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Typography sx={{ color: isActive ? '#44FF44' : '#FF4444', fontSize: 12, fontWeight: 'bold' }}>{u.name?.[0]?.toUpperCase() || '?'}</Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography sx={{ color: isActive ? '#e0e0e0' : '#666', fontSize: 13, fontWeight: 'bold' }}>{u.name}</Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography sx={{ color: '#888', fontSize: 12 }}>{u.email}</Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Chip label={isAdmin ? 'Admin' : 'Membro'} size="small" sx={{ bgcolor: isAdmin ? 'rgba(255,170,0,0.15)' : 'rgba(68,255,68,0.1)', color: isAdmin ? '#FFAA00' : '#44FF44', fontSize: 9, height: 18 }} />
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Chip label={isActive ? 'Ativo' : 'Suspenso'} size="small" sx={{ bgcolor: isActive ? 'rgba(68,255,68,0.1)' : 'rgba(255,68,68,0.1)', color: isActive ? '#44FF44' : '#FF4444', fontSize: 9, height: 18, border: `1px solid ${isActive ? 'rgba(68,255,68,0.2)' : 'rgba(255,68,68,0.2)'}` }} />
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography sx={{ color: '#e0e0e0', fontSize: 12, fontFamily: 'monospace' }}>${(u.balance || 0).toFixed(2)}</Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography sx={{ color: '#e0e0e0', fontSize: 12, fontFamily: 'monospace' }}>{u.totalTrades || 0}</Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography sx={{ color: (u.totalProfit || 0) >= 0 ? '#44FF44' : '#FF4444', fontSize: 12, fontFamily: 'monospace', fontWeight: 'bold' }}>
                      ${(u.totalProfit || 0).toFixed(2)}
                    </Typography>
                  </TableCell>
                  <TableCell sx={cellSx}>
                    <Typography sx={{ color: '#666', fontSize: 11 }}>{u.created_at?.slice(0, 10) || 'N/A'}</Typography>
                  </TableCell>
                  <TableCell sx={cellSx} onClick={e => e.stopPropagation()}>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                      {u.id !== user?.id ? (
                        <>
                          <Tooltip title="Ver historico de trades">
                            <Button size="small" onClick={() => openDrawer(u.id, 3)} sx={{ fontSize: 10, textTransform: 'none', minWidth: 0, px: 1, py: 0.25, color: '#4a9eff', border: '1px solid rgba(74,158,255,0.3)', '&:hover': { bgcolor: 'rgba(74,158,255,0.1)' } }}>
                              Trades
                            </Button>
                          </Tooltip>
                          <Tooltip title={isActive ? 'Suspender' : 'Ativar'}>
                            <Button size="small" onClick={() => handleToggleStatus(u.id, u.status || 'active')} sx={{ fontSize: 10, textTransform: 'none', minWidth: 0, px: 1, py: 0.25, color: isActive ? '#FFAA00' : '#44FF44', border: `1px solid ${isActive ? 'rgba(255,170,0,0.3)' : 'rgba(68,255,68,0.3)'}`, '&:hover': { bgcolor: isActive ? 'rgba(255,170,0,0.1)' : 'rgba(68,255,68,0.1)' } }}>
                              {isActive ? 'Suspender' : 'Ativar'}
                            </Button>
                          </Tooltip>
                          <Tooltip title="Excluir permanentemente">
                            <Button size="small" onClick={() => openDeleteConfirm(u)} sx={{ fontSize: 10, textTransform: 'none', minWidth: 0, px: 1, py: 0.25, color: '#FF4444', border: '1px solid rgba(255,68,68,0.5)', bgcolor: 'rgba(255,68,68,0.08)', '&:hover': { bgcolor: 'rgba(255,68,68,0.2)' } }}>
                              Excluir
                            </Button>
                          </Tooltip>
                        </>
                      ) : (
                        <Chip label="Voce" size="small" sx={{ bgcolor: 'rgba(68,255,68,0.1)', color: '#44FF44', fontSize: 9, height: 18 }} />
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredUsers.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} sx={{ borderBottom: 'none' }}>
                  <Typography sx={{ color: '#555', textAlign: 'center', py: 3, fontSize: 13 }}>
                    {search ? 'Nenhum membro encontrado' : 'Nenhum membro cadastrado'}
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Dialog: Novo Membro */}
      <Dialog open={newMemberOpen} onClose={() => setNewMemberOpen(false)} PaperProps={{ sx: { bgcolor: '#1e1e1e', border: '1px solid #333', minWidth: 400 } }}>
        <DialogTitle sx={{ color: '#44FF44', fontWeight: 'bold', fontSize: 16 }}>Novo Membro</DialogTitle>
        <DialogContent>
          <Box component="form" onSubmit={handleCreate} sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField size="small" label="Nome" value={newName} onChange={e => setNewName(e.target.value)} required sx={inputSx} />
            <TextField size="small" label="Email" type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} required sx={inputSx} />
            <TextField size="small" label="Senha" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required sx={inputSx} />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setNewMemberOpen(false)} sx={{ color: '#888' }}>Cancelar</Button>
          <Button onClick={handleCreate} variant="contained" sx={{ bgcolor: '#44FF44', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#33cc33' } }}>Criar Membro</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Confirmar Exclusao */}
      <Dialog open={deleteConfirmOpen} onClose={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }} PaperProps={{ sx: { bgcolor: '#1e1e1e', border: '1px solid #FF4444', minWidth: 400 } }}>
        <DialogTitle sx={{ color: '#FF4444', fontWeight: 'bold', fontSize: 16 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FF4444" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            Confirmar Exclusao
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(255,68,68,0.1)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.3)' }}>
            Esta acao e irreversivel!
          </Alert>
          <Typography sx={{ color: '#e0e0e0', mb: 1 }}>
            Tem certeza que deseja excluir permanentemente o membro:
          </Typography>
          {deleteTarget && (
            <Paper sx={{ p: 2, bgcolor: '#121212', border: '1px solid #333' }}>
              <Typography sx={{ color: '#e0e0e0', fontWeight: 'bold', fontSize: 14 }}>{deleteTarget.name}</Typography>
              <Typography sx={{ color: '#888', fontSize: 12 }}>{deleteTarget.email}</Typography>
              <Typography sx={{ color: '#666', fontSize: 11, mt: 0.5 }}>
                Saldo: ${(deleteTarget.balance || 0).toFixed(2)} | {deleteTarget.totalTrades || 0} trades | P/L: ${(deleteTarget.totalProfit || 0).toFixed(2)}
              </Typography>
            </Paper>
          )}
          <Typography sx={{ color: '#FF4444', fontSize: 12, mt: 2 }}>
            Todos os dados, trades e configuracoes serao perdidos.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => { setDeleteConfirmOpen(false); setDeleteTarget(null); }} sx={{ color: '#888' }}>Cancelar</Button>
          <Button onClick={handleDelete} variant="contained" sx={{ bgcolor: '#FF4444', color: '#fff', fontWeight: 'bold', '&:hover': { bgcolor: '#cc0000' } }}>
            Excluir Permanentemente
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Confirmar Reset Aprendizado */}
      <Dialog open={resetLearningConfirm} onClose={() => setResetLearningConfirm(false)} PaperProps={{ sx: { bgcolor: '#1e1e1e', border: '1px solid #FFAA00', minWidth: 400 } }}>
        <DialogTitle sx={{ color: '#FFAA00', fontWeight: 'bold', fontSize: 16 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#FFAA00" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            Resetar Aprendizado do LLM
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2, bgcolor: 'rgba(255,170,0,0.1)', color: '#FFAA00', border: '1px solid rgba(255,170,0,0.3)' }}>
            Esta acao e irreversivel!
          </Alert>
          <Typography sx={{ color: '#e0e0e0', mb: 1 }}>
            Tem certeza que deseja resetar todo o aprendizado do LLM?
          </Typography>
          <Typography sx={{ color: '#888', fontSize: 12 }}>
            Isso ira apagar: acuracia geral, threshold adaptativo, historico de erros, performance por par/estrategia e relatorios semanais.
          </Typography>
          <Typography sx={{ color: '#FFAA00', fontSize: 12, mt: 1 }}>
            O LLM continuara funcionando, mas perdera toda a memoria de aprendizado acumulada.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setResetLearningConfirm(false)} sx={{ color: '#888' }}>Cancelar</Button>
          <Button onClick={handleResetLearning} disabled={resettingLearning} variant="contained" sx={{ bgcolor: '#FF4444', color: '#fff', fontWeight: 'bold', '&:hover': { bgcolor: '#cc0000' } }}>
            {resettingLearning ? 'Resetando...' : 'Resetar Aprendizado'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Drawer: Detalhe do Membro */}
      <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { bgcolor: '#1a1a1a', borderLeft: '1px solid #333', width: 440, maxWidth: '90vw' } }}>
        {drawerUserDetail && (
          <Box sx={{ p: 0, height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: '1px solid #333', display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: '50%', bgcolor: (drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? 'rgba(68,255,68,0.15)' : 'rgba(255,68,68,0.15)', border: `2px solid ${(drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? 'rgba(68,255,68,0.3)' : 'rgba(255,68,68,0.3)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography sx={{ color: (drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? '#44FF44' : '#FF4444', fontSize: 18, fontWeight: 'bold' }}>{drawerUserDetail.name?.[0]?.toUpperCase() || '?'}</Typography>
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: '#e0e0e0', fontSize: 15, fontWeight: 'bold' }}>{drawerUserDetail.name}</Typography>
                <Typography sx={{ color: '#888', fontSize: 12 }}>{drawerUserDetail.email}</Typography>
              </Box>
              <IconButton onClick={() => setDrawerOpen(false)} sx={{ color: '#666' }}>
                <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </IconButton>
            </Box>

            {/* Tabs */}
            <Box sx={{ borderBottom: '1px solid #333' }}>
              <Tabs value={drawerTab} onChange={(_, v) => setDrawerTab(v)} sx={{ minHeight: 36, '& .MuiTab-root': { minHeight: 36, fontSize: 12, textTransform: 'none' } }}>
                <Tab label="Perfil" />
                <Tab label="Editar" />
                <Tab label="Seguranca" />
                <Tab label={`Trades (${drawerTrades.length})`} />
              </Tabs>
            </Box>

            {/* Content */}
            <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
              {/* Tab: Perfil */}
              {drawerTab === 0 && (
                <Box>
                  <Grid container spacing={1.5} sx={{ mb: 2 }}>
                    <Grid item xs={6}><StatCard label="SALDO" value={`$${drawerUserDetail.balance?.toFixed(2) || '0.00'}`} color="#e0e0e0" /></Grid>
                    <Grid item xs={6}><StatCard label="EQUITY" value={`$${drawerUserDetail.equity?.toFixed(2) || '0.00'}`} color="#4a9eff" /></Grid>
                    <Grid item xs={6}><StatCard label="TRADES" value={drawerUserDetail.totalTrades || 0} color="#e0e0e0" /></Grid>
                    <Grid item xs={6}><StatCard label="P/L" value={`$${drawerUserDetail.totalProfit?.toFixed(2) || '0.00'}`} color={(drawerUserDetail.totalProfit || 0) >= 0 ? '#44FF44' : '#FF4444'} /></Grid>
                  </Grid>

                  <Divider sx={{ borderColor: '#333', my: 2 }} />

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: '#666', fontSize: 12 }}>Papel</Typography>
                      <Chip label={drawerUserDetail.role === 'admin' ? 'Administrador' : 'Membro'} size="small" sx={{ bgcolor: drawerUserDetail.role === 'admin' ? 'rgba(255,170,0,0.15)' : 'rgba(68,255,68,0.1)', color: drawerUserDetail.role === 'admin' ? '#FFAA00' : '#44FF44', fontSize: 10 }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: '#666', fontSize: 12 }}>Status</Typography>
                      <Chip label={(drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? 'Ativo' : 'Suspenso'} size="small" sx={{ bgcolor: (drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? 'rgba(68,255,68,0.1)' : 'rgba(255,68,68,0.1)', color: (drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? '#44FF44' : '#FF4444', fontSize: 10 }} />
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: '#666', fontSize: 12 }}>Criado em</Typography>
                      <Typography sx={{ color: '#e0e0e0', fontSize: 12 }}>{drawerUserDetail.created_at?.slice(0, 16).replace('T', ' ') || 'N/A'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: '#666', fontSize: 12 }}>Ultimo login</Typography>
                      <Typography sx={{ color: drawerUserDetail.last_login ? '#e0e0e0' : '#555', fontSize: 12 }}>{drawerUserDetail.last_login?.slice(0, 16).replace('T', ' ') || 'Nunca'}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography sx={{ color: '#666', fontSize: 12 }}>ID</Typography>
                      <Typography sx={{ color: '#555', fontSize: 10, fontFamily: 'monospace' }}>{drawerUserDetail.id?.slice(0, 12)}...</Typography>
                    </Box>
                  </Box>
                </Box>
              )}

              {/* Tab: Editar */}
              {drawerTab === 1 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#44FF44', mb: 2, fontWeight: 'bold' }}>Editar Perfil</Typography>
                  <TextField fullWidth size="small" label="Nome" value={editName} onChange={e => setEditName(e.target.value)} sx={{ mb: 2, ...inputSx }} />
                  <TextField fullWidth size="small" label="Email" type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} sx={{ mb: 2, ...inputSx }} />
                  <Button variant="contained" fullWidth onClick={handleUpdateUser} sx={{ bgcolor: '#44FF44', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#33cc33' } }}>
                    Salvar Alteracoes
                  </Button>

                  <Divider sx={{ borderColor: '#333', my: 3 }} />

                  {drawerUserDetail.id !== user?.id && (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button variant="outlined" fullWidth onClick={() => handleToggleRole(drawerUserDetail.id, drawerUserDetail.role)} sx={{ borderColor: 'rgba(74,158,255,0.3)', color: '#4a9eff', '&:hover': { borderColor: '#4a9eff', bgcolor: 'rgba(74,158,255,0.1)' } }}>
                          {drawerUserDetail.role === 'admin' ? 'Rebaixar para Membro' : 'Promover a Admin'}
                        </Button>
                        <Button variant="outlined" fullWidth onClick={() => handleToggleStatus(drawerUserDetail.id, drawerUserDetail.status || 'active')} sx={{ borderColor: (drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? 'rgba(255,170,0,0.3)' : 'rgba(68,255,68,0.3)', color: (drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? '#FFAA00' : '#44FF44', '&:hover': { bgcolor: (drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? 'rgba(255,170,0,0.1)' : 'rgba(68,255,68,0.1)' } }}>
                          {(drawerUserDetail.status === 'active' || !drawerUserDetail.status) ? 'Suspender' : 'Ativar'}
                        </Button>
                      </Box>

                      <Divider sx={{ borderColor: '#333', my: 1 }} />

                      <Button variant="contained" fullWidth onClick={() => openDeleteConfirm(drawerUserDetail)} sx={{ bgcolor: '#FF4444', color: '#fff', fontWeight: 'bold', '&:hover': { bgcolor: '#cc0000' } }}>
                        Excluir Membro Permanentemente
                      </Button>
                    </Box>
                  )}
                </Box>
              )}

              {/* Tab: Seguranca */}
              {drawerTab === 2 && (
                <Box>
                  <Typography variant="subtitle2" sx={{ color: '#FFAA00', mb: 2, fontWeight: 'bold' }}>Resetar Senha</Typography>
                  <Alert severity="info" sx={{ mb: 2, bgcolor: 'rgba(74,158,255,0.1)', color: '#4a9eff', border: '1px solid rgba(74,158,255,0.2)' }}>
                    Defina uma nova senha para este membro. O membro precisara usar a nova senha no proximo login.
                  </Alert>
                  <TextField fullWidth size="small" label="Nova Senha" type="password" value={resetPassword} onChange={e => setResetPassword(e.target.value)} sx={{ mb: 2, ...inputSx }} />
                  <Button variant="contained" fullWidth onClick={handleResetPassword} sx={{ bgcolor: '#FFAA00', color: '#000', fontWeight: 'bold', '&:hover': { bgcolor: '#cc8800' } }}>
                    Resetar Senha
                  </Button>
                </Box>
              )}

              {/* Tab: Historico de Trades */}
              {drawerTab === 3 && (
                <Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ color: '#4a9eff', fontWeight: 'bold' }}>Historico de Trades</Typography>
                    <Chip label={`${drawerTrades.length} trades`} size="small" sx={{ bgcolor: 'rgba(74,158,255,0.15)', color: '#4a9eff', fontSize: 10 }} />
                  </Box>
                  {drawerTrades.length === 0 ? (
                    <Box sx={{ textAlign: 'center', py: 4 }}>
                      <Typography sx={{ color: '#555', fontSize: 13, mb: 1 }}>Nenhum trade registrado</Typography>
                      <Typography sx={{ color: '#444', fontSize: 11 }}>Este membro ainda nao realizou nenhum trade.</Typography>
                    </Box>
                  ) : (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {drawerTrades.map((t) => (
                        <Paper key={t.id} sx={{ p: 1.5, bgcolor: '#1e1e1e', border: '1px solid #222' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Typography sx={{ color: '#e0e0e0', fontSize: 12, fontWeight: 'bold' }}>{t.symbol}</Typography>
                                <Chip label={t.type} size="small" sx={{ bgcolor: t.type === 'BUY' ? 'rgba(68,255,68,0.15)' : 'rgba(255,68,68,0.15)', color: t.type === 'BUY' ? '#44FF44' : '#FF4444', fontSize: 9, height: 16 }} />
                                {t.source && <Chip label={t.source} size="small" sx={{ bgcolor: 'rgba(255,255,255,0.05)', color: '#888', fontSize: 8, height: 14 }} />}
                                {t.signal_source && <Chip label={t.signal_source} size="small" sx={{ bgcolor: 'rgba(74,158,255,0.1)', color: '#4a9eff', fontSize: 8, height: 14 }} />}
                              </Box>
                              <Typography sx={{ color: '#666', fontSize: 10 }}>Vol: {t.volume} | Preco: {t.price}</Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography sx={{ color: (t.profit || 0) >= 0 ? '#44FF44' : '#FF4444', fontSize: 13, fontWeight: 'bold', fontFamily: 'monospace' }}>
                                ${(t.profit || 0).toFixed(2)}
                              </Typography>
                              <Typography sx={{ color: '#555', fontSize: 9 }}>{t.time?.slice(0, 16).replace('T', ' ')}</Typography>
                            </Box>
                          </Box>
                        </Paper>
                      ))}
                    </Box>
                  )}
                </Box>
              )}
            </Box>
          </Box>
        )}
      </Drawer>
    </Box>
  );
}
