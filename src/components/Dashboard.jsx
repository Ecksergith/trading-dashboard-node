import { useState, useEffect } from 'react';
import { Box, Tabs, Tab, AppBar, Toolbar, Typography, Chip, IconButton } from '@mui/material';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import TradingTab from './tabs/TradingTab';
import ManagementTab from './tabs/ManagementTab';
import PerformanceTab from './tabs/PerformanceTab';
import AssetsTab from './tabs/AssetsTab';
import AIAgentTab from './tabs/AIAgentTab';
import LogsTab from './tabs/LogsTab';
import AccountsTab from './tabs/AccountsTab';
import AccountPerformanceTab from './tabs/AccountPerformanceTab';
import AdminTab from './tabs/AdminTab';
import ProfileTab from './tabs/ProfileTab';
import SelfImproveTab from './tabs/SelfImproveTab';




export default function Dashboard() {
  const [tab, setTab] = useState(0);
  const { connected, accountInfo, riskSettings } = useApp();
  const { user, logout } = useAuth();
  const [showRiskPopup, setShowRiskPopup] = useState(false);
  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    const timer = setTimeout(() => setShowRiskPopup(true), 100);
    const autoClose = setTimeout(() => setShowRiskPopup(false), 10000);
    return () => { clearTimeout(timer); clearTimeout(autoClose); };
  }, []);

  useEffect(() => {
    if (showRiskPopup) {
      const t = setTimeout(() => setShowRiskPopup(false), 10000);
      return () => clearTimeout(t);
    }
  }, [showRiskPopup]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: '#121212' }}>
      <AppBar position="static" sx={{ bgcolor: '#1a1a1a', borderBottom: '1px solid #333' }}>
        <Toolbar variant="dense" sx={{ minHeight: 40 }}>
          <Typography variant="h6" sx={{ color: '#44FF44', fontWeight: 'bold', mr: 2, fontSize: 16 }}>
            UkuloTrade
          </Typography>

          <Chip
            label={<span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: connected ? '#44FF44' : '#FF4444', display: 'inline-block' }} />{connected ? 'Online' : 'Offline'}</span>}
            size="small"
            sx={{ mr: 1, bgcolor: '#2a2a2a', color: connected ? '#44FF44' : '#FF4444', fontSize: 11 }}
          />

          {accountInfo && (
            <>
              <Chip label={`Saldo: $${(accountInfo.balance || 0).toFixed(2)}`} size="small" sx={{ mr: 1, bgcolor: '#2a2a2a', fontSize: 11 }} />
              <Chip label={`Equity: $${(accountInfo.equity || 0).toFixed(2)}`} size="small" sx={{ mr: 1, bgcolor: '#2a2a2a', fontSize: 11 }} />
              <Chip label={`P/L: $${((accountInfo.equity || 0) - (accountInfo.balance || 0)).toFixed(2)}`} size="small" sx={{ mr: 1, bgcolor: '#2a2a2a', color: ((accountInfo.equity || 0) - (accountInfo.balance || 0)) >= 0 ? '#44FF44' : '#FF4444', fontSize: 11 }} />
            </>
          )}

          <Box sx={{ flex: 1 }} />

          <Typography variant="caption" sx={{ color: '#666', mr: 1 }}>
            Auto Trading: {riskSettings.auto_trading ? 'ATIVADO' : 'DESATIVADO'}
          </Typography>
          <Chip label={`MT5: ${connected ? 'ON' : 'OFF'}`} size="small"
            sx={{ bgcolor: '#2a2a2a', color: connected ? '#44FF44' : '#FF4444', fontSize: 11 }} />

          <Chip label={user?.email || 'User'} size="small"
            sx={{ bgcolor: '#2a2a2a', color: '#aaa', fontSize: 11, ml: 1 }} />

          <IconButton onClick={logout} size="small" title="Sair"
            sx={{ color: '#FF4444', ml: 0.5, fontSize: 12, '&:hover': { bgcolor: 'rgba(255,68,68,0.15)' } }}>
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </IconButton>
        </Toolbar>
      </AppBar>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          bgcolor: '#1a1a1a',
          borderBottom: '1px solid #333',
          minHeight: 36,
          '& .MuiTab-root': { minHeight: 36, fontSize: 12, textTransform: 'none' },
        }}
      >
        <Tab label="Negociacao" />
        <Tab label="Gerenciamento" />
        <Tab label="Desempenho" />
        <Tab label="Desempenho/Conta" />
        <Tab label="Ativos" />
        <Tab label="Contas" />
        <Tab label="Agente IA" />
        <Tab label="Aprendizado" />
        <Tab label="Logs" />
        <Tab label="Perfil" />
        {isAdmin && <Tab label="Admin" />}
      </Tabs>

      <Box sx={{ flex: 1, overflow: 'auto', p: 1 }}>
        {tab === 0 && <TradingTab />}
        {tab === 1 && <ManagementTab />}
        {tab === 2 && <PerformanceTab />}
        {tab === 3 && <AccountPerformanceTab />}
        {tab === 4 && <AssetsTab />}
        {tab === 5 && <AccountsTab />}
        {tab === 6 && <AIAgentTab />}
        {tab === 7 && <SelfImproveTab />}
        {tab === 8 && <LogsTab />}
        {tab === 9 && <ProfileTab />}
        {tab === 10 && isAdmin && <AdminTab />}
      </Box>

      {showRiskPopup && (
        <RiskPopup onClose={() => setShowRiskPopup(false)} />
      )}
    </Box>
  );
}

function RiskPopup({ onClose }) {
  const { riskSettings, lotSettings } = useApp();

  useEffect(() => {
    const t = setTimeout(onClose, 10000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <Box sx={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 1300,
      bgcolor: '#1e1e1e', border: '1px solid #44FF44', borderRadius: 2,
      p: 2, maxWidth: 400, boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
    }}>
      <Typography variant="h6" sx={{ color: '#44FF44', mb: 1, fontSize: 14 }}>Configuracoes de Risco</Typography>
      <Typography variant="body2" sx={{ color: '#aaa', mb: 1, fontSize: 11 }}>
        Modo de lote: {lotSettings.mode} | Stop Loss: {riskSettings.ifvg_stop_loss}pts | Take Profit: {riskSettings.ifvg_take_profit}pts
      </Typography>
      <Typography variant="body2" sx={{ color: '#aaa', mb: 1, fontSize: 11 }}>
        RR: {riskSettings.risk_reward_ratio}:1 | Protecao LLM: {riskSettings.llm_position_protection ? 'Sim' : 'Nao'}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
        <Box component="button" onClick={onClose} sx={{
          flex: 1, bgcolor: '#44FF44', color: '#000', border: 'none', borderRadius: 1,
          p: 0.5, cursor: 'pointer', fontWeight: 'bold', fontSize: 12,
        }}>OK</Box>
      </Box>
      <Typography variant="caption" sx={{ color: '#666', mt: 0.5, display: 'block', fontSize: 10 }}>
        Fecha automaticamente em 10s
      </Typography>
    </Box>
  );
}
