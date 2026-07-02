import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const AppContext = createContext(null);

const API_BASE = '';

export function AppProvider({ children }) {
  const { getToken } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [accountInfo, setAccountInfo] = useState(null);
  const [positions, setPositions] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [riskSettings, setRiskSettings] = useState({});
  const [lotSettings, setLotSettings] = useState({});
  const [aiAgentSettings, setAiAgentSettings] = useState({});
  const [modelCounters, setModelCounters] = useState({});
  const [priceData, setPriceData] = useState({});
  const [tradeHistory, setTradeHistory] = useState([]);
  const [equityHistory, setEquityHistory] = useState([]);
  const [logs, setLogs] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [accountsSummary, setAccountsSummary] = useState({});
  const [autoTraderRunning, setAutoTraderRunning] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const s = io(window.location.origin, {
      transports: ['websocket', 'polling'],
      auth: { token },
    });
    setSocket(s);

    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));

    s.on('initial-state', (data) => {
      setRiskSettings(data.riskSettings || {});
      setLotSettings(data.lotSettings || {});
      setPairs(data.pairs || []);
      setAiAgentSettings(data.aiAgentSettings || {});
      if (data.tradeHistory) setTradeHistory(data.tradeHistory);
      if (data.equityHistory) setEquityHistory(data.equityHistory);
      if (data.priceData) setPriceData(data.priceData);
      if (data.logs) setLogs(data.logs);
      if (data.autoTraderRunning !== undefined) setAutoTraderRunning(data.autoTraderRunning);
    });

    s.on('market-update', (data) => {
      if (data.account) setAccountInfo(data.account);
      if (data.positions) setPositions(data.positions);
      if (data.priceData) setPriceData(data.priceData);
    });

    s.on('settings-updated', (data) => {
      if (data.riskSettings) {
        setRiskSettings(data.riskSettings);
        if (data.riskSettings.auto_trading !== undefined) {
          setAutoTraderRunning(data.riskSettings.auto_trading);
        }
      }
      if (data.lotSettings) setLotSettings(data.lotSettings);
      if (data.aiAgentSettings) setAiAgentSettings(data.aiAgentSettings);
    });

    s.on('accounts-update', (data) => {
      if (data) setAccounts(data);
    });

    s.on('accounts-updated', (data) => {
      if (data) setAccounts(data);
    });

    s.on('accounts-summary', (data) => {
      if (data) setAccountsSummary(data);
    });

    s.on('auto-trader-status', (data) => {
      if (data.running !== undefined) setAutoTraderRunning(data.running);
    });

    s.on('trade-history-update', (data) => {
      if (data) setTradeHistory(data);
    });

    s.emit('request-update');
    setTimeout(() => s.emit('request-accounts-update'), 1000);

    const statusPoll = setInterval(async () => {
      try {
        const res = await apiGet('/api/auto-trader/status');
        if (res && res.running !== undefined) setAutoTraderRunning(res.running);
        if (res && res.auto_trading !== undefined) {
          setRiskSettings(prev => {
            if (prev.auto_trading !== res.auto_trading) {
              return { ...prev, auto_trading: res.auto_trading };
            }
            return prev;
          });
        }
      } catch {}
    }, 10000);

    return () => { clearInterval(statusPoll); s.disconnect(); };
  }, []);

  const apiGet = useCallback(async (path) => {
    try {
      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}${path}`, { headers });
      return await res.json();
    } catch (e) { return null; }
  }, [getToken]);

  const apiPost = useCallback(async (path, body) => {
    try {
      const token = getToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) { return null; }
  }, [getToken]);

  const apiDelete = useCallback(async (path) => {
    try {
      const token = getToken();
      const headers = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE', headers });
      return await res.json();
    } catch (e) { return null; }
  }, [getToken]);

  const addLog = useCallback((level, message) => {
    setLogs(prev => [...prev.slice(-999), { time: new Date().toISOString(), level, message }]);
    try {
      const token = getToken();
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      fetch(`${API_BASE}/api/logs`, { method: 'POST', headers, body: JSON.stringify({ level, message }) });
    } catch {}
  }, [getToken]);

  const value = {
    socket, connected, accountInfo, positions, pairs, riskSettings, lotSettings,
    aiAgentSettings, modelCounters, priceData, tradeHistory, equityHistory, logs, setRiskSettings, setLotSettings,
    setAiAgentSettings, setModelCounters, setPairs, setTradeHistory, addLog,
    apiGet, apiPost, apiDelete,
    accounts, setAccounts, accountsSummary, setAccountsSummary,
    autoTraderRunning, setAutoTraderRunning,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
