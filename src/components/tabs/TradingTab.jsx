import React from 'react';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Box, Button, Grid, Paper, Typography, Select, MenuItem, FormControl, InputLabel, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress, Divider, ToggleButton, ToggleButtonGroup } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceDot, ComposedChart, Bar } from 'recharts';
import { useApp } from '../../context/AppContext';

const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1'];

function cleanReason(text) {
  if (!text || typeof text !== 'string') return '';
  if (text.startsWith('{') || text.startsWith('`')) {
    const m = text.match(/"reason"[:\s]*"([^"]+)"/i);
    return m ? m[1] : '';
  }
  return text;
}



function SignalBadge({ signal, score, size = 'small' }) {
  const isBuy = signal === 'buy';
  const isSell = signal === 'sell';
  return (
    <Chip
      size={size}
      label={isBuy ? 'COMPRA' : isSell ? 'VENDA' : 'NEUTRO'}
      sx={{
        bgcolor: isBuy ? 'rgba(68,255,68,0.15)' : isSell ? 'rgba(255,68,68,0.15)' : 'rgba(136,136,136,0.15)',
        color: isBuy ? '#44FF44' : isSell ? '#FF4444' : '#888',
        fontWeight: 'bold',
        fontSize: size === 'small' ? 9 : 11,
        height: size === 'small' ? 20 : 26,
        border: `1px solid ${isBuy ? '#44FF44' : isSell ? '#FF4444' : '#555'}`,
      }}
    />
  );
}

function PairCard({ pair, priceData, signal, llm, analyzing, isSelected, onClick }) {
  const data = priceData[pair];
  const lastPrice = data?.length ? data[data.length - 1]?.close : 0;
  const firstPrice = data?.length ? data[0]?.close : 0;
  const change = firstPrice ? ((lastPrice - firstPrice) / firstPrice * 100) : 0;
  const sig = signal || {};
  const llmData = llm || {};
  const llmAction = llmData.action || 'wait';
  const llmConf = llmData.confidence || 0;
  const llmReason = cleanReason(llmData.reason || '');
  const isLlmBuy = llmAction === 'buy';
  const isLlmSell = llmAction === 'sell';
  const isBuy = sig.signal === 'buy';
  const isSell = sig.signal === 'sell';
  const borderColor = analyzing ? '#FFAA00' : isSelected ? '#44FF44' : isLlmBuy ? 'rgba(68,255,68,0.3)' : isLlmSell ? 'rgba(255,68,68,0.3)' : '#333';
  const sigColor = isLlmBuy ? '#44FF44' : isLlmSell ? '#FF4444' : '#888';
  const llmColor = isLlmBuy ? '#44FF44' : isLlmSell ? '#FF4444' : '#FFAA00';
  const confColor = llmConf >= 0.7 ? '#44FF44' : llmConf >= 0.5 ? '#FFAA00' : '#FF4444';

  return (
    <Paper
      onClick={onClick}
      sx={{
        p: 1, bgcolor: '#1a1a1a', cursor: 'pointer', border: `1px solid ${borderColor}`,
        transition: 'all 0.2s', '&:hover': { borderColor: '#44FF44', bgcolor: '#1e1e1e' },
      }}
    >
      {analyzing && <LinearProgress sx={{ height: 3, mb: 0.5, bgcolor: '#333', '& .MuiLinearProgress-bar': { bgcolor: '#FFAA00', animation: 'pulse 1s ease-in-out infinite' }, '@keyframes pulse': { '0%': { opacity: 0.6 }, '50%': { opacity: 1 }, '100%': { opacity: 0.6 } } }} />}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ color: isSelected ? '#44FF44' : analyzing ? '#FFAA00' : '#e0e0e0', fontSize: 12, fontWeight: 'bold' }}>{pair}</Typography>
        <SignalBadge signal={isLlmBuy ? 'buy' : isLlmSell ? 'sell' : sig.signal} score={llmConf || sig.score} />
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <Box>
          <Typography sx={{ color: '#e0e0e0', fontSize: 13, fontWeight: 'bold' }}>{lastPrice?.toFixed(5)}</Typography>
          <Typography sx={{ color: change >= 0 ? '#44FF44' : '#FF4444', fontSize: 10 }}>
            {change >= 0 ? '+' : ''}{change.toFixed(3)}%
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', minWidth: 70 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <Typography sx={{ color: '#aaa', fontSize: 9 }}>LLM</Typography>
            <Typography sx={{ color: analyzing ? '#FFAA00' : llmColor, fontSize: 11, fontWeight: 'bold' }}>
              {analyzing ? '...' : isLlmBuy ? 'BUY' : isLlmSell ? 'SELL' : 'WAIT'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
            <Typography sx={{ color: '#aaa', fontSize: 9 }}>Conf</Typography>
            <Typography sx={{ color: confColor, fontSize: 10, fontWeight: 'bold' }}>
              {analyzing ? '...' : `${(llmConf * 100).toFixed(0)}%`}
            </Typography>
          </Box>
          {llmReason && !analyzing && (
            <Typography sx={{ color: '#666', fontSize: 8, maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'right' }}>
              {llmReason.slice(0, 30)}
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

export default function TradingTab() {
  const { socket, accountInfo, positions, pairs, priceData, connected, autoTraderRunning, setAutoTraderRunning, apiGet, apiPost, riskSettings, tradeHistory } = useApp();
  const [selectedPair, setSelectedPair] = useState('EURUSD');
  const [selectedTimeframe, setSelectedTimeframe] = useState('M5');
  const [manualLot, setManualLot] = useState(0.01);
  const [tradeLoading, setTradeLoading] = useState(false);
  const [tradeMsg, setTradeMsg] = useState('');
  const [chartData, setChartData] = useState([]);
  const [chartType, setChartType] = useState(() => localStorage.getItem('td_chartType') || 'line');
  const [visibleCount, setVisibleCount] = useState(100);
  const [panOffset, setPanOffset] = useState(0);
  const panRef = useRef(null);
  const [allSignals, setAllSignals] = useState({});
  const [llmLatest, setLlmLatest] = useState({});
  const [llmHistory, setLlmHistory] = useState([]);
  const [llmAnalyzing, setLlmAnalyzing] = useState({});
  const [dragState, setDragState] = useState(null);
  const [modifyLoading, setModifyLoading] = useState(false);
  const defaultCandleColors = { bullBody: '#00FF00', bullWick: '#00FF00', bearBody: '#FF0000', bearWick: '#FF0000' };
  const [candleColors, setCandleColors] = useState(() => {
    try { return JSON.parse(localStorage.getItem('td_candleColors')) || defaultCandleColors; } catch { return defaultCandleColors; }
  });
  const [showCandleSettings, setShowCandleSettings] = useState(false);
  const [contextMenu, setContextMenu] = useState(null);
  const [positionView, setPositionView] = useState('open');
  const defaultBg = 'rgba(255,255,255,0.18)';
  const darkBg = '#111111';
  const [chartBg, setChartBg] = useState(() => localStorage.getItem('td_chartBg') || defaultBg);
  const chartContainerRef = useRef(null);
  const dragRef = useRef(null);

  const llmOrderCount = useMemo(() => {
    if (!positions || !tradeHistory) return 0;
    return positions.filter(pos =>
      tradeHistory.some(t => String(t.ticket) === String(pos.ticket) && t.source === 'auto_trade' && (t.signalSource === 'LLM' || t.signal_source === 'LLM'))
    ).length;
  }, [positions, tradeHistory]);

  useEffect(() => {
    let cancelled = false;
    const update = (raw) => {
      if (cancelled || !raw || !raw.length) return;
      const newData = raw.map((d, i) => ({
        time: i, open: d.open, high: d.high, low: d.low, close: d.close, rawTime: d.time || d.rawTime,
      }));
      setChartData(newData);
      setPanOffset(Math.max(0, newData.length - visibleCount));
    };
    if (selectedTimeframe === 'M5') {
      update(priceData[selectedPair]);
      return () => { cancelled = true; };
    }
    const fetchTF = () => {
      fetch(`/api/market-data/${selectedPair}/${selectedTimeframe}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          const arr = Array.isArray(data) ? data : Array.isArray(data?.value) ? data.value : Array.isArray(data?.rates) ? data.rates : null;
          if (arr) update(arr);
        })
        .catch(() => {});
    };
    fetchTF();
    const interval = setInterval(fetchTF, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [priceData, selectedPair, selectedTimeframe]);

  useEffect(() => {
    const fetchAllSignals = async () => {
      try {
        const [sigData, latestData, histData] = await Promise.all([
          apiGet('/api/signals'),
          apiGet('/api/llm/latest'),
          apiGet('/api/llm/history?limit=20'),
        ]);
        if (sigData && !sigData.error) setAllSignals(sigData);
        if (latestData && !latestData.error) setLlmLatest(latestData);
        if (Array.isArray(histData)) setLlmHistory(histData);
      } catch {}
    };
    fetchAllSignals();
    const t = setInterval(fetchAllSignals, 10000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!socket) return;
    const onAnalysis = (data) => {
      setLlmLatest(prev => ({ ...prev, [data.pair]: data.analysis }));
      setLlmHistory(prev => [{ time: data.time, pair: data.pair, ...data.analysis, status: 'auto_analysis' }, ...prev].slice(0, 30));
      setLlmAnalyzing(prev => ({ ...prev, [data.pair]: false }));
    };
    const onAnalyzing = (data) => {
      setLlmAnalyzing(prev => ({ ...prev, [data.pair]: true }));
    };
    socket.on('llm-analysis', onAnalysis);
    socket.on('llm-analyzing', onAnalyzing);
    return () => { socket.off('llm-analysis', onAnalysis); socket.off('llm-analyzing', onAnalyzing); };
  }, [socket]);

  const handleManualTrade = async (type) => {
    setTradeLoading(true);
    setTradeMsg('');
    try {
      const currentPrice = priceData[selectedPair]?.[priceData[selectedPair]?.length - 1]?.close || 0;
      const slPips = riskSettings.ifvg_stop_loss || 50;
      const tpPips = riskSettings.ifvg_take_profit || (slPips * (riskSettings.risk_reward_ratio || 2));
      const slDistance = slPips / 10000;
      const tpDistance = tpPips / 10000;

      const order = {
        symbol: selectedPair,
        type,
        volume: manualLot,
        comment: 'Manual Dashboard',
        stop_loss: type === 'buy'
          ? +(currentPrice - slDistance).toFixed(5)
          : +(currentPrice + slDistance).toFixed(5),
        take_profit: type === 'buy'
          ? +(currentPrice + tpDistance).toFixed(5)
          : +(currentPrice - tpDistance).toFixed(5),
      };

      const data = await apiPost('/api/trade', order);
      if (data?.status === 'success') {
        setTradeMsg(`${type} ${selectedPair} ${manualLot} lot - Ticket #${data.ticket}`);
      } else {
        setTradeMsg(`Erro: ${data.message || data.error}`);
      }
    } catch (e) {
      setTradeMsg(`Erro: ${e.message}`);
    }
    setTradeLoading(false);
  };

  const handleToggleAutoTrade = async () => {
    const newState = !autoTraderRunning;
    setTradeLoading(true);
    setTradeMsg('');
    try {
      let data;
      if (newState) {
        data = await apiPost('/api/auto-trader/start', { interval: 30000 });
        if (data?.ok) {
          setTradeMsg('Auto Trading ATIVADO');
          setAutoTraderRunning(true);
        } else {
          setTradeMsg('Erro ao ativar Auto Trading');
          setTradeLoading(false);
          return;
        }
      } else {
        data = await apiPost('/api/auto-trader/stop');
        if (data?.ok) {
          setTradeMsg('Auto Trading DESATIVADO');
          setAutoTraderRunning(false);
        }
      }
      setTimeout(async () => {
        try {
          const s = await apiGet('/api/auto-trader/status');
          if (s && s.running !== undefined) setAutoTraderRunning(s.running);
        } catch {}
      }, 500);
    } catch (e) {
      setTradeMsg(`Erro: ${e.message}`);
    }
    setTradeLoading(false);
  };

  const latestPrice = chartData.length ? chartData[chartData.length - 1]?.close : 0;
  const selectedSignals = allSignals[selectedPair] || {};
  const selectedLlm = llmLatest[selectedPair] || {};
  const selectedLlmReason = cleanReason(selectedLlm.reason || '');
  const ind = selectedSignals.indicators || {};

  useEffect(() => { localStorage.setItem('td_chartType', chartType); }, [chartType]);
  useEffect(() => { localStorage.setItem('td_candleColors', JSON.stringify(candleColors)); }, [candleColors]);
  useEffect(() => { localStorage.setItem('td_chartBg', chartBg); }, [chartBg]);

  const pairPositions = positions.filter(p => p.symbol === selectedPair);

  const maxStart = Math.max(0, chartData.length - visibleCount);
  const clampedPan = Math.min(Math.max(panOffset, 0), maxStart);
  const visibleData = chartData.slice(clampedPan, clampedPan + visibleCount);

  const candleDomain = (() => {
    if (!visibleData.length) return ['auto', 'auto'];
    const allPrices = visibleData.flatMap(d => [d.high, d.low]);
    const pMin = Math.min(...allPrices);
    const pMax = Math.max(...allPrices);
    const pad = (pMax - pMin) * 0.1 || 0.001;
    return [pMin - pad, pMax + pad];
  })();

  const handleZoomIn = () => {
    setVisibleCount(prev => {
      const newCount = Math.max(10, prev - 20);
      setPanOffset(pan => {
        const center = pan + prev / 2;
        const newPan = Math.round(center - newCount / 2);
        return Math.min(Math.max(newPan, 0), Math.max(0, chartData.length - newCount));
      });
      return newCount;
    });
  };
  const handleZoomOut = () => {
    setVisibleCount(prev => {
      const newCount = Math.min(prev + 20, chartData.length);
      setPanOffset(pan => {
        const center = pan + prev / 2;
        const newPan = Math.round(center - newCount / 2);
        return Math.min(Math.max(newPan, 0), Math.max(0, chartData.length - newCount));
      });
      return newCount;
    });
  };
  const handleResetView = () => {
    setVisibleCount(100);
    setPanOffset(Math.max(0, chartData.length - 100));
  };

  const handleChartWheel = useCallback((e) => {
    e.preventDefault();
    setVisibleCount(prev => {
      const delta = e.deltaY < 0 ? -10 : 10;
      const newCount = Math.min(Math.max(prev + delta, 10), chartData.length);
      setPanOffset(pan => {
        const center = pan + prev / 2;
        const newPan = Math.round(center - newCount / 2);
        return Math.min(Math.max(newPan, 0), Math.max(0, chartData.length - newCount));
      });
      return newCount;
    });
  }, [chartData.length]);

  const handlePanStart = useCallback((e) => {
    if (dragRef.current || e.button !== 0) return;
    panRef.current = { startX: e.clientX, startPan: clampedPan };
  }, [clampedPan]);

  const handlePanMove = useCallback((e) => {
    if (!panRef.current || dragRef.current) return;
    const dx = e.clientX - panRef.current.startX;
    const candleWidth = chartContainerRef.current ? chartContainerRef.current.getBoundingClientRect().width / visibleCount : 5;
    const candleShift = Math.round(dx / candleWidth);
    const newPan = panRef.current.startPan - candleShift;
    setPanOffset(Math.min(Math.max(newPan, 0), Math.max(0, chartData.length - visibleCount)));
  }, [chartData.length, visibleCount]);

  const handlePanEnd = useCallback(() => {
    panRef.current = null;
  }, []);

  const getChartDomain = useCallback(() => {
    if (!visibleData.length) return null;
    const closes = visibleData.map(d => d.close);
    const minP = Math.min(...closes);
    const maxP = Math.max(...closes);
    const padding = (maxP - minP) * 0.1 || 0.001;
    return { domainMin: minP - padding, domainMax: maxP + padding };
  }, [visibleData]);

  const pixelToPrice = useCallback((clientY) => {
    const el = chartContainerRef.current;
    if (!el || !visibleData.length) return null;
    const rect = el.getBoundingClientRect();
    const chartTop = 30;
    const chartBottom = rect.height - 20;
    const chartHeight = chartBottom - chartTop;
    const relY = clientY - rect.top;
    if (relY < chartTop || relY > chartBottom) return null;
    const { domainMin, domainMax } = getChartDomain();
    return domainMax - ((relY - chartTop) / chartHeight) * (domainMax - domainMin);
  }, [visibleData, getChartDomain]);

  const priceToPixelY = useCallback((price) => {
    const el = chartContainerRef.current;
    if (!el || !visibleData.length) return null;
    const rect = el.getBoundingClientRect();
    const chartTop = 30;
    const chartBottom = rect.height - 20;
    const chartHeight = chartBottom - chartTop;
    const { domainMin, domainMax } = getChartDomain();
    const ratio = (domainMax - price) / (domainMax - domainMin);
    return chartTop + ratio * chartHeight;
  }, [chartData, getChartDomain]);

  const handleChartMouseDown = useCallback((e) => {
    const price = pixelToPrice(e.clientY);
    if (!price) return;
    for (const pos of pairPositions) {
      if (pos.stop_loss > 0 && Math.abs(price - pos.stop_loss) / pos.stop_loss < 0.002) {
        dragRef.current = { type: 'sl', ticket: pos.ticket, posIndex: pos, startY: e.clientY };
        setDragState({ type: 'sl', ticket: pos.ticket, currentPrice: pos.stop_loss, oldPrice: pos.stop_loss });
        e.preventDefault();
        return;
      }
      if (pos.take_profit > 0 && Math.abs(price - pos.take_profit) / pos.take_profit < 0.002) {
        dragRef.current = { type: 'tp', ticket: pos.ticket, posIndex: pos, startY: e.clientY };
        setDragState({ type: 'tp', ticket: pos.ticket, currentPrice: pos.take_profit, oldPrice: pos.take_profit });
        e.preventDefault();
        return;
      }
    }
  }, [pairPositions, pixelToPrice]);

  const handleChartMouseMove = useCallback((e) => {
    if (!dragRef.current) return;
    const price = pixelToPrice(e.clientY);
    if (price) {
      setDragState(prev => prev ? { ...prev, currentPrice: price } : null);
    }
  }, [pixelToPrice]);

  const handleChartMouseUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  const handleChartContextMenu = useCallback((e) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [contextMenu]);

  useEffect(() => {
    if (!showCandleSettings) return;
    const close = (e) => {
      if (!e.target.closest('[data-candle-settings]')) setShowCandleSettings(false);
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showCandleSettings]);

  const handleConfirmModify = async () => {
    if (!dragState) return;
    setModifyLoading(true);
    try {
      const pos = pairPositions.find(p => p.ticket === dragState.ticket);
      if (!pos) return;
      const newSL = dragState.type === 'sl' ? dragState.currentPrice : pos.stop_loss;
      const newTP = dragState.type === 'tp' ? dragState.currentPrice : pos.take_profit;
      const data = await apiPost('/api/modify-position', { ticket: dragState.ticket, sl: newSL, tp: newTP });
      if (data?.status === 'success') {
        setDragState(null);
      } else {
        console.error('Modify failed:', data);
      }
    } catch (err) {
      console.error('Modify error:', err);
    }
    setModifyLoading(false);
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Toolbar */}
      <Paper sx={{ p: 1, bgcolor: '#1a1a1a', display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel sx={{ color: '#888' }}>Par</InputLabel>
          <Select value={selectedPair} label="Par" onChange={e => setSelectedPair(e.target.value)} sx={{ color: '#e0e0e0', fontSize: 12 }}>
            {pairs.map(p => <MenuItem key={p} value={p} sx={{ fontSize: 12 }}>{p}</MenuItem>)}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 90 }}>
          <InputLabel sx={{ color: '#888' }}>Timeframe</InputLabel>
          <Select value={selectedTimeframe} label="Timeframe" onChange={e => setSelectedTimeframe(e.target.value)} sx={{ color: '#e0e0e0', fontSize: 12 }}
            MenuProps={{ PaperProps: { sx: { bgcolor: '#2a2a2a', border: '1px solid #444', maxHeight: 300 } } }}>
            {TIMEFRAMES.map(tf => <MenuItem key={tf} value={tf} sx={{ fontSize: 12, color: '#e0e0e0', '&:hover': { bgcolor: '#3a3a3a' }, '&.Mui-selected': { bgcolor: '#1b5e20', '&:hover': { bgcolor: '#2e7d32' } } }}>{tf}</MenuItem>)}
          </Select>
        </FormControl>
        <Button
          variant="contained"
          size="small"
          disabled={tradeLoading || !connected}
          onClick={handleToggleAutoTrade}
          sx={{
            fontWeight: 'bold', fontSize: 11, minWidth: 110, px: 2,
            bgcolor: autoTraderRunning ? '#1b5e20' : '#4a3800',
            color: autoTraderRunning ? '#44FF44' : '#FFAA00',
            border: `1px solid ${autoTraderRunning ? '#44FF44' : '#FFAA00'}`,
            boxShadow: autoTraderRunning ? '0 0 8px rgba(68,255,68,0.3)' : 'none',
            '&:hover': {
              bgcolor: autoTraderRunning ? '#2e7d32' : '#5c4a00',
              boxShadow: autoTraderRunning ? '0 0 12px rgba(68,255,68,0.5)' : '0 0 8px rgba(255,170,0,0.3)',
            },
            '&.Mui-disabled': { bgcolor: '#333', color: '#555', border: '1px solid #444' },
            transition: 'all 0.3s',
          }}
        >
          {autoTraderRunning ? 'AUTO TRADING ON' : 'AUTO TRADING OFF'}
        </Button>
        {tradeMsg && (
          <Typography sx={{ fontSize: 10, color: tradeMsg.startsWith('Erro') ? '#FF4444' : '#44FF44', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {tradeMsg}
          </Typography>
        )}
        {!autoTraderRunning && (
          <>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: '#333' }} />
            <FormControl size="small" sx={{ minWidth: 70 }}>
              <InputLabel sx={{ color: '#888' }}>Lote</InputLabel>
              <Select value={manualLot} label="Lote" onChange={e => setManualLot(e.target.value)} sx={{ color: '#e0e0e0', fontSize: 12 }}>
                {[0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1.0].map(v => <MenuItem key={v} value={v} sx={{ fontSize: 12 }}>{v}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" size="small" disabled={tradeLoading || !connected}
              onClick={() => handleManualTrade('BUY')}
              sx={{ bgcolor: '#1b5e20', color: '#44FF44', fontWeight: 'bold', fontSize: 11, minWidth: 60,
                '&:hover': { bgcolor: '#2e7d32' }, '&.Mui-disabled': { bgcolor: '#333', color: '#555' } }}>
              BUY
            </Button>
            <Button variant="contained" size="small" disabled={tradeLoading || !connected}
              onClick={() => handleManualTrade('SELL')}
              sx={{ bgcolor: '#b71c1c', color: '#FF4444', fontWeight: 'bold', fontSize: 11, minWidth: 60,
                '&:hover': { bgcolor: '#c62828' }, '&.Mui-disabled': { bgcolor: '#333', color: '#555' } }}>
              SELL
            </Button>
          </>
        )}
        {autoTraderRunning && (
          <>
            <Divider orientation="vertical" flexItem sx={{ bgcolor: '#333' }} />
            <Chip label="Auto Trading ATIVO" size="small" sx={{ bgcolor: 'rgba(68,255,68,0.15)', color: '#44FF44', fontSize: 10, border: '1px solid #44FF44' }} />
          </>
        )}
        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#333' }} />
        <Chip label={`Trades: ${accountInfo?.total_trades || 0}`} size="small" sx={{ bgcolor: '#2a2a2a', fontSize: 11 }} />
        <Chip label={`P/L: $${(accountInfo?.profit || 0).toFixed(2)}`} size="small"
          sx={{ bgcolor: '#2a2a2a', color: (accountInfo?.profit || 0) >= 0 ? '#44FF44' : '#FF4444', fontSize: 11 }} />
        <Chip label={`Win Rate: ${accountInfo?.win_rate || 0}%`} size="small" sx={{ bgcolor: '#2a2a2a', fontSize: 11 }} />
        <Chip label={`MT5: ${connected ? 'ON' : 'OFF'}`} size="small"
          sx={{ bgcolor: connected ? '#1b5e20' : '#b71c1c', color: connected ? '#44FF44' : '#FF4444', fontSize: 11 }} />
      </Paper>

      {/* Grafico (esquerda) + Visao Geral (direita) */}
      <Grid container spacing={1}>
        {/* Grafico - lateral esquerda */}
        <Grid item xs={12} md={9}>
          <Box sx={{ height: 480, overflow: 'hidden', bgcolor: chartBg, border: '1px solid #44FF44', borderRadius: 1, display: 'flex', flexDirection: 'column', transition: 'background-color 0.3s' }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 1, pt: 1, pb: 0.5 }}>
                <Typography variant="caption" sx={{ color: '#44FF44' }}>
                  {selectedPair} - {selectedTimeframe} | Preco: {latestPrice?.toFixed(5)} | Candle: {chartData.length} | {new Date().toLocaleTimeString('pt-BR', { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone })} ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  <ToggleButtonGroup value={chartType} exclusive onChange={(_, v) => v && setChartType(v)} size="small" sx={{ '& .MuiToggleButton-root': { color: '#888', borderColor: '#444', px: 1, py: 0, fontSize: 10, textTransform: 'none', '&.Mui-selected': { bgcolor: '#333', color: '#44FF44', '&:hover': { bgcolor: '#3a3a3a' } } } }}>
                    <ToggleButton value="line">Linha</ToggleButton>
                    <ToggleButton value="candle">Candle</ToggleButton>
                  </ToggleButtonGroup>
                  {chartType === 'candle' && (
                    <Box sx={{ position: 'relative' }} data-candle-settings>
                      <Button size="small" onClick={() => setShowCandleSettings(!showCandleSettings)} sx={{ color: '#888', fontSize: 11, minWidth: 0, p: 0.5, '&:hover': { color: '#fff' } }}>
                        &#9881;
                      </Button>
                      {showCandleSettings && (
                        <Paper sx={{ position: 'absolute', top: '100%', right: 0, mt: 0.5, p: 1, bgcolor: '#2a2a2a', border: '1px solid #444', zIndex: 20, minWidth: 180 }}>
                          <Typography sx={{ color: '#aaa', fontSize: 10, mb: 0.5, fontWeight: 'bold' }}>Cores do Candle</Typography>
                          {[
                            { key: 'bullBody', label: 'Candle Alta (Corpo)' },
                            { key: 'bullWick', label: 'Candle Alta (Pavio)' },
                            { key: 'bearBody', label: 'Candle Baixa (Corpo)' },
                            { key: 'bearWick', label: 'Candle Baixa (Pavio)' },
                          ].map(c => (
                            <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.25 }}>
                              <Typography sx={{ color: '#ccc', fontSize: 10 }}>{c.label}</Typography>
                              <input type="color" value={candleColors[c.key]} onChange={e => setCandleColors(prev => ({ ...prev, [c.key]: e.target.value }))} style={{ width: 22, height: 18, border: '1px solid #555', borderRadius: 3, padding: 0, cursor: 'pointer' }} />
                            </Box>
                          ))}
                          <Typography sx={{ color: '#aaa', fontSize: 10, mt: 0.75, mb: 0.25, fontWeight: 'bold' }}>Pre definidos</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {[
                              { label: 'Verde/Vermelho', bull: '#00FF00', bear: '#FF0000' },
                              { label: 'Branco/Preto', bull: '#FFFFFF', bear: '#000000' },
                            ].map(p => (
                              <Button key={p.label} size="small" variant="outlined" onClick={() => setCandleColors({ bullBody: p.bull, bullWick: p.bull, bearBody: p.bear, bearWick: p.bear })} sx={{ color: '#ccc', fontSize: 9, textTransform: 'none', borderColor: '#555', minWidth: 0, px: 0.5, py: 0.25, '&:hover': { borderColor: '#888' } }}>
                                {p.label}
                              </Button>
                            ))}
                          </Box>
                          <Typography sx={{ color: '#aaa', fontSize: 10, mt: 0.75, mb: 0.25, fontWeight: 'bold' }}>Fundo</Typography>
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Button size="small" variant="outlined" onClick={() => setChartBg(prev => prev === darkBg ? defaultBg : darkBg)} sx={{ color: '#ccc', fontSize: 9, textTransform: 'none', borderColor: chartBg === darkBg ? '#44FF44' : '#555', minWidth: 0, px: 1, '&:hover': { borderColor: '#888' } }}>
                              {chartBg === darkBg ? 'Preto Fosco' : 'Padrao'}
                            </Button>
                          </Box>
                          <Button size="small" fullWidth onClick={() => { setCandleColors(defaultCandleColors); setShowCandleSettings(false); }} sx={{ color: '#888', fontSize: 10, mt: 0.5, textTransform: 'none', borderColor: '#555', '&:hover': { borderColor: '#888' } }} variant="outlined">
                            Restaurar Padrao
                          </Button>
                        </Paper>
                      )}
                    </Box>
                  )}
                  <SignalBadge signal={selectedLlm.action === 'buy' ? 'buy' : selectedLlm.action === 'sell' ? 'sell' : selectedSignals.signal} score={selectedLlm.confidence || selectedSignals.score} size="medium" />
                  <Chip size="small" label={`LLM: ${selectedLlm.confidence ? (selectedLlm.confidence * 100).toFixed(0) + '%' : '-'}`} sx={{ bgcolor: '#2a2a2a', fontSize: 11 }} />
                  <Chip size="small" label={`TI: ${((selectedSignals.score || 0) * 100).toFixed(0)}%`} sx={{ bgcolor: '#2a2a2a', fontSize: 11 }} />
                  <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center', ml: 0.5, borderLeft: '1px solid #444', pl: 0.75 }}>
                    <Button size="small" onClick={handleZoomIn} sx={{ color: '#888', fontSize: 12, minWidth: 22, p: 0, '&:hover': { color: '#44FF44' } }}>+</Button>
                    <Button size="small" onClick={handleZoomOut} sx={{ color: '#888', fontSize: 12, minWidth: 22, p: 0, '&:hover': { color: '#44FF44' } }}>&#8722;</Button>
                    <Button size="small" onClick={handleResetView} sx={{ color: '#888', fontSize: 9, minWidth: 0, textTransform: 'none', p: 0.25, '&:hover': { color: '#fff' } }}>Reset</Button>
                    <Typography sx={{ color: '#666', fontSize: 9 }}>{visibleCount}</Typography>
                  </Box>
                </Box>
              </Box>
              <Box
                ref={chartContainerRef}
                onMouseDown={(e) => { handleChartMouseDown(e); handlePanStart(e); }}
                onMouseMove={(e) => { handleChartMouseMove(e); handlePanMove(e); }}
                onMouseUp={() => { handleChartMouseUp(); handlePanEnd(); }}
                onMouseLeave={() => { handleChartMouseUp(); handlePanEnd(); }}
                onContextMenu={handleChartContextMenu}
                onWheel={handleChartWheel}
                sx={{ flex: 1, minHeight: 0, px: 0.5, pb: 0.5, position: 'relative', cursor: dragState ? 'ns-resize' : 'crosshair' }}
              >
                <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 0, textAlign: 'center' }}>
                  <Typography sx={{ color: 'rgba(255,255,255,0.04)', fontSize: 72, fontWeight: 'bold', letterSpacing: 8, userSelect: 'none', whiteSpace: 'nowrap' }}>
                    {selectedPair}
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.025)', fontSize: 18, letterSpacing: 4, userSelect: 'none', mt: -1 }}>
                    UkuloTrade
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'line' ? (
                    <AreaChart data={visibleData}>
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#44FF44" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#44FF44" stopOpacity={0.05} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="0" stroke="transparent" />
                      <XAxis dataKey="time" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#555', strokeWidth: 1 }} tickLine={{ stroke: '#555', strokeWidth: 1 }} />
                      <YAxis domain={['auto', 'auto']} tickFormatter={(v) => v?.toFixed(5)} tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#555', strokeWidth: 1 }} tickLine={{ stroke: '#555', strokeWidth: 1 }} />
                      <Tooltip contentStyle={{ bgcolor: '#2a2a2a', border: '1px solid #444', fontSize: 11 }} />
                      {pairPositions.map((pos, i) => {
                        const isBuy = pos.type === 0;
                        const posColor = isBuy ? '#44FF44' : '#FF4444';
                        const isDraggingSL = dragState?.type === 'sl' && dragState?.ticket === pos.ticket;
                        const isDraggingTP = dragState?.type === 'tp' && dragState?.ticket === pos.ticket;
                        const slPrice = isDraggingSL ? dragState.currentPrice : pos.stop_loss;
                        const tpPrice = isDraggingTP ? dragState.currentPrice : pos.take_profit;
                        return [
                          <ReferenceLine key={`entry-${i}`} y={pos.open_price} stroke={posColor} strokeWidth={1.5} strokeDasharray="6 3" label={{ value: `${isBuy ? 'BUY' : 'SELL'} ${pos.open_price?.toFixed(5)}`, fill: posColor, fontSize: 10, fontWeight: 'bold', position: 'insideTopRight' }} />,
                          (() => {
                            const posTime = pos.time;
                            let entryIdx = 0; let minDiff = Infinity;
                            chartData.forEach((c, ci) => { if (c.rawTime) { const diff = Math.abs(c.rawTime - posTime); if (diff < minDiff) { minDiff = diff; entryIdx = ci; } } });
                            const arrowProps = { cx: 0, cy: 0 };
                            return <ReferenceDot key={`dot-${i}`} x={entryIdx} y={pos.open_price} r={0} isFront={true}
                              shape={({ cx, cy }) => (
                                isBuy
                                  ? <polygon points={`${cx},${cy - 8} ${cx - 5},${cy + 1} ${cx + 5},${cy + 1}`} fill={posColor} stroke="#fff" strokeWidth={0.5} />
                                  : <polygon points={`${cx},${cy + 8} ${cx - 5},${cy - 1} ${cx + 5},${cy - 1}`} fill={posColor} stroke="#fff" strokeWidth={0.5} />
                              )}
                            />;
                          })(),
                          slPrice > 0 && <ReferenceLine key={`sl-${i}`} y={slPrice} stroke={isDraggingSL ? '#FF3333' : '#FF6666'} strokeWidth={isDraggingSL ? 2 : 1} strokeDasharray="4 4" label={{ value: `SL ${slPrice?.toFixed(5)}`, fill: isDraggingSL ? '#FF3333' : '#FF6666', fontSize: 9, position: 'insideBottomRight' }} />,
                          tpPrice > 0 && <ReferenceLine key={`tp-${i}`} y={tpPrice} stroke={isDraggingTP ? '#33FF33' : '#66FF66'} strokeWidth={isDraggingTP ? 2 : 1} strokeDasharray="4 4" label={{ value: `TP ${tpPrice?.toFixed(5)}`, fill: isDraggingTP ? '#33FF33' : '#66FF66', fontSize: 9, position: 'insideTopRight' }} />,
                        ];
                      })}
                      {latestPrice > 0 && <ReferenceLine y={latestPrice} stroke="rgba(255,200,60,0.4)" strokeWidth={1} ifOverflow="extendDomain" />}
                      <Area type="monotone" dataKey="close" stroke="#44FF44" strokeWidth={2} fill="url(#chartGrad)" />
                    </AreaChart>
                  ) : (
                    <ComposedChart data={visibleData}>
                      <CartesianGrid strokeDasharray="0" stroke="transparent" />
                      <XAxis dataKey="time" tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#555', strokeWidth: 1 }} tickLine={{ stroke: '#555', strokeWidth: 1 }} />
                      <YAxis domain={candleDomain} tickFormatter={(v) => v?.toFixed(5)} tick={{ fill: '#888', fontSize: 11 }} axisLine={{ stroke: '#555', strokeWidth: 1 }} tickLine={{ stroke: '#555', strokeWidth: 1 }} />
                      <Tooltip
                        contentStyle={{ bgcolor: '#2a2a2a', border: '1px solid #444', fontSize: 11 }}
                        content={({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const d = payload[0]?.payload;
                          if (!d) return null;
                          const isGreen = d.close >= d.open;
                          return (
                            <Box sx={{ bgcolor: '#2a2a2a', border: '1px solid #444', p: 0.5, fontSize: 11 }}>
                              <div style={{ color: isGreen ? '#44FF44' : '#FF4444', fontWeight: 'bold' }}>O: {d.open?.toFixed(5)}</div>
                              <div style={{ color: '#e0e0e0' }}>H: {d.high?.toFixed(5)}</div>
                              <div style={{ color: '#e0e0e0' }}>L: {d.low?.toFixed(5)}</div>
                              <div style={{ color: isGreen ? '#44FF44' : '#FF4444', fontWeight: 'bold' }}>C: {d.close?.toFixed(5)}</div>
                            </Box>
                          );
                        }}
                      />
                      {pairPositions.map((pos, i) => {
                        const isBuy = pos.type === 0;
                        const posColor = isBuy ? '#44FF44' : '#FF4444';
                        const isDraggingSL = dragState?.type === 'sl' && dragState?.ticket === pos.ticket;
                        const isDraggingTP = dragState?.type === 'tp' && dragState?.ticket === pos.ticket;
                        const slPrice = isDraggingSL ? dragState.currentPrice : pos.stop_loss;
                        const tpPrice = isDraggingTP ? dragState.currentPrice : pos.take_profit;
                        return [
                          <ReferenceLine key={`entry-${i}`} y={pos.open_price} stroke={posColor} strokeWidth={1.5} strokeDasharray="6 3" label={{ value: `${isBuy ? 'BUY' : 'SELL'} ${pos.open_price?.toFixed(5)}`, fill: posColor, fontSize: 10, fontWeight: 'bold', position: 'insideTopRight' }} />,
                          (() => {
                            const posTime = pos.time;
                            let entryIdx = 0; let minDiff = Infinity;
                            chartData.forEach((c, ci) => { if (c.rawTime) { const diff = Math.abs(c.rawTime - posTime); if (diff < minDiff) { minDiff = diff; entryIdx = ci; } } });
                            return <ReferenceDot key={`dot-${i}`} x={entryIdx} y={pos.open_price} r={0} isFront={true}
                              shape={({ cx, cy }) => (
                                isBuy
                                  ? <polygon points={`${cx},${cy - 8} ${cx - 5},${cy + 1} ${cx + 5},${cy + 1}`} fill={posColor} stroke="#fff" strokeWidth={0.5} />
                                  : <polygon points={`${cx},${cy + 8} ${cx - 5},${cy - 1} ${cx + 5},${cy - 1}`} fill={posColor} stroke="#fff" strokeWidth={0.5} />
                              )}
                            />;
                          })(),
                          slPrice > 0 && <ReferenceLine key={`sl-${i}`} y={slPrice} stroke={isDraggingSL ? '#FF3333' : '#FF6666'} strokeWidth={isDraggingSL ? 2 : 1} strokeDasharray="4 4" label={{ value: `SL ${slPrice?.toFixed(5)}`, fill: isDraggingSL ? '#FF3333' : '#FF6666', fontSize: 9, position: 'insideBottomRight' }} />,
                          tpPrice > 0 && <ReferenceLine key={`tp-${i}`} y={tpPrice} stroke={isDraggingTP ? '#33FF33' : '#66FF66'} strokeWidth={isDraggingTP ? 2 : 1} strokeDasharray="4 4" label={{ value: `TP ${tpPrice?.toFixed(5)}`, fill: isDraggingTP ? '#33FF33' : '#66FF66', fontSize: 9, position: 'insideTopRight' }} />,
                        ];
                      })}
                      {latestPrice > 0 && <ReferenceLine y={latestPrice} stroke="rgba(255,200,60,0.4)" strokeWidth={1} ifOverflow="extendDomain" />}
                      <Bar dataKey="high" fill="transparent" isAnimationActive={false} />
                      <Bar dataKey="close" isAnimationActive={false} shape={(props) => {
                        const { x, y, width, height, payload } = props;
                        if (!payload) return null;
                        const { open, high, low, close } = payload;
                        const isGreen = close >= open;
                        const bodyColor = isGreen ? candleColors.bullBody : candleColors.bearBody;
                        const wickColor = isGreen ? candleColors.bullWick : candleColors.bearWick;
                        const allPrices = visibleData.flatMap(d => [d.high, d.low]);
                        const pMin = Math.min(...allPrices);
                        const pMax = Math.max(...allPrices);
                        const pad = (pMax - pMin) * 0.1 || 0.001;
                        const range = pMax + pad - (pMin - pad);
                        const chartH = props.background?.height || 400;
                        const pxPerUnit = chartH / range;
                        const bodyTop = (pMax + pad - Math.max(open, close)) * pxPerUnit;
                        const bodyBot = (pMax + pad - Math.min(open, close)) * pxPerUnit;
                        const bodyH = Math.abs(close - open) * pxPerUnit || 1;
                        const wickTop = (pMax + pad - high) * pxPerUnit;
                        const wickBot = (pMax + pad - low) * pxPerUnit;
                        const candleW = Math.max(width * 0.6, 4);
                        const candleX = x + (width - candleW) / 2;
                        const cx = x + width / 2;
                        return (
                          <g>
                            {high > Math.max(open, close) && <line x1={cx} y1={wickTop} x2={cx} y2={bodyTop} stroke={wickColor} strokeWidth={1} />}
                            {low < Math.min(open, close) && <line x1={cx} y1={bodyBot} x2={cx} y2={wickBot} stroke={wickColor} strokeWidth={1} />}
                            <rect x={candleX} y={bodyTop} width={candleW} height={Math.max(bodyH, 2)} fill={bodyColor} fillOpacity={isGreen ? 0.4 : 0.8} stroke={bodyColor} strokeWidth={0.5} rx={1} />
                          </g>
                        );
                      }} />
                    </ComposedChart>
                  )}
                </ResponsiveContainer>
                {dragState && (() => {
                  const lineY = priceToPixelY(dragState.currentPrice);
                  const btnTop = lineY != null ? Math.max(4, Math.min(lineY - 14, 440)) : 8;
                  return (
                    <Box sx={{ position: 'absolute', top: btnTop, right: 8, display: 'flex', gap: 0.5, zIndex: 10, transition: 'top 0.05s linear' }}>
                      <Button
                        size="small"
                        variant="contained"
                        disabled={modifyLoading}
                        onClick={handleConfirmModify}
                        sx={{
                          bgcolor: dragState.type === 'sl' ? '#b71c1c' : '#1b5e20',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 'bold',
                          minWidth: 50,
                          textTransform: 'none',
                          boxShadow: '0 0 8px rgba(0,0,0,0.5)',
                          '&:hover': { bgcolor: dragState.type === 'sl' ? '#c62828' : '#2e7d32' },
                        }}
                      >
                        {modifyLoading ? '...' : `Confirmar ${dragState.type.toUpperCase()}`}
                      </Button>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => setDragState(null)}
                        sx={{
                          bgcolor: '#424242',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 'bold',
                          minWidth: 30,
                          textTransform: 'none',
                          boxShadow: '0 0 8px rgba(0,0,0,0.5)',
                          '&:hover': { bgcolor: '#616161' },
                        }}
                      >
                        X
                      </Button>
                    </Box>
                  );
                })()}
                {contextMenu && chartType === 'candle' && (
                  <Paper sx={{ position: 'fixed', left: contextMenu.x, top: contextMenu.y, bgcolor: '#2a2a2a', border: '1px solid #444', zIndex: 30, py: 0.5, minWidth: 160 }} onClick={e => e.stopPropagation()}>
                    <Typography sx={{ color: '#aaa', fontSize: 10, px: 1, mb: 0.5, fontWeight: 'bold' }}>Configurar Cores</Typography>
                    {[
                      { key: 'bullBody', label: 'Alta - Corpo' },
                      { key: 'bullWick', label: 'Alta - Pavio' },
                      { key: 'bearBody', label: 'Baixa - Corpo' },
                      { key: 'bearWick', label: 'Baixa - Pavio' },
                    ].map(c => (
                      <Box key={c.key} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1, py: 0.25, '&:hover': { bgcolor: '#333' } }}>
                        <Typography sx={{ color: '#ccc', fontSize: 10 }}>{c.label}</Typography>
                        <input type="color" value={candleColors[c.key]} onChange={e => setCandleColors(prev => ({ ...prev, [c.key]: e.target.value }))} style={{ width: 20, height: 16, border: '1px solid #555', borderRadius: 3, padding: 0, cursor: 'pointer' }} />
                      </Box>
                    ))}
                    <Typography sx={{ color: '#aaa', fontSize: 10, px: 1, mt: 0.5, mb: 0.25, fontWeight: 'bold' }}>Pre definidos</Typography>
                    <Box sx={{ px: 1, display: 'flex', gap: 0.5 }}>
                      {[
                        { label: 'Verde/Vermelho', bull: '#00FF00', bear: '#FF0000' },
                        { label: 'Branco/Preto', bull: '#FFFFFF', bear: '#000000' },
                      ].map(p => (
                        <Button key={p.label} size="small" variant="outlined" onClick={() => { setCandleColors({ bullBody: p.bull, bullWick: p.bull, bearBody: p.bear, bearWick: p.bear }); setContextMenu(null); }} sx={{ color: '#ccc', fontSize: 9, textTransform: 'none', borderColor: '#555', minWidth: 0, px: 0.5, py: 0.25 }}>
                          {p.label}
                        </Button>
                      ))}
                    </Box>
                    <Typography sx={{ color: '#aaa', fontSize: 10, px: 1, mt: 0.5, mb: 0.25, fontWeight: 'bold' }}>Fundo</Typography>
                    <Box sx={{ px: 1, display: 'flex', gap: 0.5 }}>
                      <Button size="small" variant="outlined" onClick={() => { setChartBg(prev => prev === darkBg ? defaultBg : darkBg); setContextMenu(null); }} sx={{ color: '#ccc', fontSize: 9, textTransform: 'none', borderColor: chartBg === darkBg ? '#44FF44' : '#555', minWidth: 0, px: 1 }}>
                        {chartBg === darkBg ? 'Preto Fosco' : 'Padrao'}
                      </Button>
                    </Box>
                    <Box sx={{ px: 1, pt: 0.5, display: 'flex', gap: 0.5 }}>
                      <Button size="small" fullWidth variant="outlined" onClick={() => { setCandleColors(defaultCandleColors); setContextMenu(null); }} sx={{ color: '#888', fontSize: 9, textTransform: 'none', borderColor: '#555', py: 0.25 }}>
                        Restaurar
                      </Button>
                    </Box>
                  </Paper>
                )}
              </Box>
          </Box>
        </Grid>

        {/* Visao Geral do Mercado - lateral direita */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1, bgcolor: '#1a1a1a', height: 480, overflow: 'auto' }}>
            <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1, fontSize: 12 }}>
              Visao Geral do Mercado
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
              {pairs.map(p => (
                <PairCard
                  key={p}
                  pair={p}
                  priceData={priceData}
                  signal={allSignals[p]}
                  llm={llmLatest[p]}
                  analyzing={llmAnalyzing[p]}
                  isSelected={p === selectedPair}
                  onClick={() => setSelectedPair(p)}
                />
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Painel de Decisoes da IA */}
      <Paper sx={{ p: 1, bgcolor: '#1a1a1a', display: 'flex', gap: 1, height: 320 }}>
        {/* Esquerda: Sinais + Historico */}
        <Box sx={{ flex: 7, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography sx={{ color: '#fff', bgcolor: '#2a2a2a', px: 1, py: 0.3, fontSize: 11, fontWeight: 'bold', borderRadius: 0.5, display: 'inline-block' }}>
                Sinais de Negociacao
              </Typography>
              <Chip size="small" label={selectedPair} sx={{ bgcolor: '#44FF44', color: '#000', fontSize: 9, height: 18, fontWeight: 'bold' }} />
            </Box>

            {llmAnalyzing[selectedPair] && (
              <Box sx={{ px: 1 }}>
                <LinearProgress sx={{
                  height: 6, borderRadius: 3, bgcolor: '#222',
                  '& .MuiLinearProgress-bar': { bgcolor: '#44FF44', animation: 'pulse 1.5s ease-in-out infinite' },
                  '@keyframes pulse': { '0%': { opacity: 0.7 }, '50%': { opacity: 1 }, '100%': { opacity: 0.7 } }
                }} />
                <Typography sx={{ color: '#44FF44', fontSize: 9, mt: 0.25, textAlign: 'center' }}>
                  LLM analisando {selectedPair}...
                </Typography>
              </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 1, px: 1 }}>
              <Box>
                <Typography sx={{ color: '#888', fontSize: 10, mb: 0.25 }}>Direcao</Typography>
                <Typography sx={{
                  color: selectedLlm.action === 'buy' ? '#44FF44' : selectedLlm.action === 'sell' ? '#FF4444' : '#FFAA00',
                  fontSize: 13, fontWeight: 'bold'
                }}>
                  {llmAnalyzing[selectedPair] ? '...' :
                   selectedLlm.action === 'buy' ? 'COMPRA' :
                   selectedLlm.action === 'sell' ? 'VENDA' :
                   selectedLlm.action === 'wait' ? 'AGUARDAR' :
                   selectedLlm.action === 'close' ? 'FECHAR' :
                   'Sem sinal'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: '#888', fontSize: 10, mb: 0.25 }}>Confianca</Typography>
                <Typography sx={{
                  color: (selectedLlm.confidence || 0) >= 0.7 ? '#44FF44' : (selectedLlm.confidence || 0) >= 0.5 ? '#FFAA00' : '#FF4444',
                  fontSize: 13, fontWeight: 'bold'
                }}>
                  {llmAnalyzing[selectedPair] ? '...' :
                   selectedLlm.confidence ? `${(selectedLlm.confidence * 100).toFixed(0)}%` : '-'}
                </Typography>
              </Box>
              <Box>
                <Typography sx={{ color: '#888', fontSize: 10, mb: 0.25 }}>Decisao</Typography>
                <Typography sx={{
                  color: selectedLlm.action === 'buy' ? '#44FF44' : selectedLlm.action === 'sell' ? '#FF4444' : '#FFAA00',
                  fontSize: 12, fontWeight: 'bold'
                }}>
                  {selectedLlm.action === 'buy' ? 'Sinal de COMPRA' :
                   selectedLlm.action === 'sell' ? 'Sinal de VENDA' :
                   selectedLlm.action === 'wait' ? 'Aguardando' :
                   selectedLlm.action === 'close' ? 'Fechar Posicao' :
                   'Sem analise LLM'}
                </Typography>
                {selectedLlmReason && (
                  <Typography sx={{ color: '#bbb', fontSize: 10, mt: 0.25, lineHeight: 1.2 }}>
                    {selectedLlmReason.slice(0, 80)}{selectedLlmReason.length > 80 ? '...' : ''}
                  </Typography>
                )}
              </Box>
            </Box>

            <Divider sx={{ bgcolor: '#333' }} />

            <Box>
              <Typography sx={{ color: '#fff', bgcolor: '#2a2a2a', px: 1, py: 0.3, fontSize: 11, fontWeight: 'bold', borderRadius: 0.5, display: 'inline-block' }}>
                Historico de Decisoes
              </Typography>
            </Box>
            <Box sx={{
              borderRadius: 1, p: 1, fontFamily: '"Consolas", "Courier New", monospace',
              flex: 1, overflow: 'auto', border: '1px solid #222', minHeight: 0,
            }}>
              {llmHistory.length === 0 ? (
                <Typography sx={{ color: '#555', fontSize: 10, textAlign: 'center', mt: 2 }}>
                  Nenhuma analise LLM registrada...
                </Typography>
              ) : (
                llmHistory.map((entry, i) => {
                  const time = new Date(entry.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  const isBuy = entry.action === 'buy';
                  const isSell = entry.action === 'sell';
                  const color = isBuy ? '#7fff7f' : isSell ? '#ff6b6b' : '#FFAA00';
                  const label = isBuy ? 'COMPRA' : isSell ? 'VENDA' : entry.action?.toUpperCase() || '?';
                  const statusTag = entry.status === 'executed' ? ` [ORDENADO #${entry.ticket}]` : '';
                  return (
                    <Box key={i} sx={{ mb: 0.5 }}>
                      <Typography sx={{ color: color, fontSize: 10, wordWrap: 'break-word' }}>
                        <span style={{ color: '#888' }}>[{entry.pair}]</span> {time} - LLM: <span style={{ fontWeight: 'bold' }}>{label}</span> ({((entry.confidence || 0) * 100).toFixed(0)}%){statusTag}
                      </Typography>
                      {cleanReason(entry.reason) && (
                        <Typography sx={{ color: '#aaa', fontSize: 10, ml: 2, lineHeight: 1.2 }}>
                          {cleanReason(entry.reason).slice(0, 100)}{cleanReason(entry.reason).length > 100 ? '...' : ''}
                        </Typography>
                      )}
                    </Box>
                  );
                })
              )}
            </Box>
        </Box>

        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#333' }} />

        {/* Direita: Status */}
        <Box sx={{ flex: 5, display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
            <Box>
              <Typography sx={{ color: '#fff', bgcolor: '#2a2a2a', px: 1, py: 0.3, fontSize: 11, fontWeight: 'bold', borderRadius: 0.5, display: 'inline-block' }}>
                Status do Mercado
              </Typography>
            </Box>

            <Box sx={{ px: 1 }}>
              <Typography sx={{ color: '#888', fontSize: 10, mb: 0.5 }}>Confianca LLM</Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box sx={{ flex: 1, position: 'relative', height: 14, bgcolor: '#222', borderRadius: 7, overflow: 'hidden' }}>
                  <Box sx={{
                    height: '100%', borderRadius: 7, transition: 'width 0.5s',
                    width: `${(selectedLlm.confidence || 0) * 100}%`,
                    background: (selectedLlm.confidence || 0) >= 0.7 ? '#44FF44' : (selectedLlm.confidence || 0) >= 0.5 ? '#FFAA00' : '#FF4444',
                  }} />
                  <Typography sx={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#fff', fontSize: 10, fontWeight: 'bold', textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                  }}>
                    {llmAnalyzing[selectedPair] ? 'Analisando...' :
                     selectedLlm.confidence ? `${(selectedLlm.confidence * 100).toFixed(0)}%` : 'Sem dados'}
                  </Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ bgcolor: '#333', mx: 1 }} />

            <Box>
              <Typography sx={{ color: '#fff', bgcolor: '#2a2a2a', px: 1, py: 0.3, fontSize: 11, fontWeight: 'bold', borderRadius: 0.5, display: 'inline-block' }}>
                Status Geral
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, px: 1 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: '#888', fontSize: 11 }}>Contratos Abertos (LLM)</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: positions.length > 0 ? '#44FF44' : '#555', boxShadow: positions.length > 0 ? '0 0 6px #44FF44' : 'none' }} />
                  <Typography sx={{ color: '#44FF44', fontSize: 12, fontWeight: 'bold' }}>{positions.length}</Typography>
                  <Typography sx={{ color: '#FFAA00', fontSize: 12, fontWeight: 'bold' }}>/</Typography>
                  <Typography sx={{ color: '#FFAA00', fontSize: 12, fontWeight: 'bold' }}>{riskSettings.max_llm_positions || 5}</Typography>
                </Box>
              </Box>
              {positions.length > 0 && (
                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: 1 }}>
                  {positions.map((pos, i) => (
                    <Chip key={i} size="small" label={`${pos.symbol} ${pos.type === 0 ? 'BUY' : 'SELL'} ${pos.volume}`}
                      sx={{ bgcolor: pos.type === 0 ? 'rgba(68,255,68,0.15)' : 'rgba(255,68,68,0.15)', color: pos.type === 0 ? '#44FF44' : '#FF4444', fontSize: 9, height: 18 }} />
                  ))}
                </Box>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: '#888', fontSize: 11 }}>Pares Monitorados</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: pairs.length > 0 ? '#4a9eff' : '#555' }} />
                  <Typography sx={{ color: '#4a9eff', fontSize: 12, fontWeight: 'bold' }}>{pairs.length}</Typography>
                </Box>
              </Box>

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography sx={{ color: '#888', fontSize: 11 }}>Conexao</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: connected ? '#44FF44' : '#FF4444', boxShadow: connected ? '0 0 6px #44FF44' : '0 0 6px #FF4444' }} />
                  <Typography sx={{ color: connected ? '#44FF44' : '#FF4444', fontSize: 11 }}>{connected ? 'Conectado' : 'Desconectado'}</Typography>
                </Box>
              </Box>
            </Box>

            <Divider sx={{ bgcolor: '#333', mx: 1 }} />

            <Box sx={{ px: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: selectedLlm.time ? '#44FF44' : '#FFAA00', boxShadow: selectedLlm.time ? '0 0 6px #44FF44' : '0 0 6px #FFAA00' }} />
              <Typography sx={{ color: selectedLlm.time ? '#44FF44' : '#FFAA00', fontSize: 10 }}>
                {selectedLlm.time ? `Ultima analise: ${new Date(selectedLlm.time).toLocaleTimeString('pt-BR')}` : 'Aguardando analise do LLM'}
              </Typography>
            </Box>
        </Box>
      </Paper>

      {/* Posicoes / Historico Toggle */}
      <Paper sx={{ p: 1, bgcolor: '#1a1a1a' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <ToggleButtonGroup value={positionView} exclusive size="small" onChange={(_, v) => v && setPositionView(v)} sx={{ '& .MuiToggleButton-root': { py: 0, px: 1, fontSize: 10, borderColor: '#333', color: '#888', '&.Mui-selected': { bgcolor: 'rgba(255,170,0,0.15)', color: '#FFAA00', '&:hover': { bgcolor: 'rgba(255,170,0,0.2)' } } } }}>
            <ToggleButton value="open">Abertas ({positions.length})</ToggleButton>
            <ToggleButton value="history">Historico</ToggleButton>
          </ToggleButtonGroup>
          {positionView === 'open' && positions.length > 0 && (
            <Button size="small" variant="outlined" sx={{ color: '#FF4444', borderColor: '#FF4444', fontSize: 10, py: 0, minHeight: 0, '&:hover': { borderColor: '#FF4444', bgcolor: 'rgba(255,68,68,0.1)' } }}
              onClick={async () => {
                if (!window.confirm('Fechar TODAS as ' + positions.length + ' posicoes abertas?')) return;
                await apiPost('/api/close-all');
              }}>
              Fechar Todas
            </Button>
          )}
        </Box>

        {positionView === 'open' && positions.length > 0 && (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#FFAA00', fontSize: 11 }}>Par</TableCell>
                  <TableCell sx={{ color: '#FFAA00', fontSize: 11 }}>Tipo</TableCell>
                  <TableCell sx={{ color: '#FFAA00', fontSize: 11 }}>Volume</TableCell>
                  <TableCell sx={{ color: '#FFAA00', fontSize: 11 }}>Preco</TableCell>
                  <TableCell sx={{ color: '#FFAA00', fontSize: 11 }}>P/L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {positions.map((pos, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontSize: 11 }}>{pos.symbol}</TableCell>
                    <TableCell sx={{ fontSize: 11, color: pos.type === 0 ? '#44FF44' : '#FF4444' }}>{pos.type === 0 ? 'BUY' : 'SELL'}</TableCell>
                    <TableCell sx={{ fontSize: 11 }}>{pos.volume}</TableCell>
                    <TableCell sx={{ fontSize: 11 }}>{pos.open_price}</TableCell>
                    <TableCell sx={{ fontSize: 11, color: pos.profit >= 0 ? '#44FF44' : '#FF4444' }}>${pos.profit?.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
        {positionView === 'open' && positions.length === 0 && (
          <Typography sx={{ fontSize: 11, color: '#555', textAlign: 'center', py: 2 }}>Nenhuma posicao aberta</Typography>
        )}

        {positionView === 'history' && <ClosedTradesTable apiGet={apiGet} />}
      </Paper>
    </Box>
  );
}

function ClosedTradesTable({ apiGet }) {
  const [trades, setTrades] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const load = async () => {
    setLoading(true);
    const data = await apiGet('/api/closed-trades?limit=50');
    setTrades(data || []);
    setLoading(false);
  };

  React.useEffect(() => { load(); }, []);

  const totalProfit = trades.reduce((s, t) => s + (t.profit || 0), 0);
  const wins = trades.filter(t => t.profit > 0).length;

  return (
    <>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
        <Typography sx={{ fontSize: 9, color: '#666' }}>
          {trades.length} trades | {wins}W/{trades.length - wins}L | P/L: <span style={{ color: totalProfit >= 0 ? '#44FF44' : '#FF4444' }}>${totalProfit.toFixed(2)}</span>
        </Typography>
        <Button size="small" variant="outlined" onClick={load} disabled={loading}
          sx={{ color: '#FFAA00', borderColor: '#444', fontSize: 10, py: 0, minHeight: 0, '&:hover': { borderColor: '#FFAA00' } }}>
          {loading ? '...' : 'Atualizar'}
        </Button>
      </Box>
      {trades.length > 0 && (
        <TableContainer sx={{ maxHeight: 250 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#FFAA00', fontSize: 10, bgcolor: '#1a1a1a' }}>Par</TableCell>
                <TableCell sx={{ color: '#FFAA00', fontSize: 10, bgcolor: '#1a1a1a' }}>Tipo</TableCell>
                <TableCell sx={{ color: '#FFAA00', fontSize: 10, bgcolor: '#1a1a1a' }}>Vol</TableCell>
                <TableCell sx={{ color: '#FFAA00', fontSize: 10, bgcolor: '#1a1a1a' }}>Entrada</TableCell>
                <TableCell sx={{ color: '#FFAA00', fontSize: 10, bgcolor: '#1a1a1a' }}>Saida</TableCell>
                <TableCell sx={{ color: '#FFAA00', fontSize: 10, bgcolor: '#1a1a1a' }}>P/L</TableCell>
                <TableCell sx={{ color: '#FFAA00', fontSize: 10, bgcolor: '#1a1a1a' }}>Fonte</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {trades.map((t, i) => (
                <TableRow key={i}>
                  <TableCell sx={{ fontSize: 10 }}>{t.symbol}</TableCell>
                  <TableCell sx={{ fontSize: 10, color: t.type === 'BUY' ? '#44FF44' : '#FF4444' }}>{t.type}</TableCell>
                  <TableCell sx={{ fontSize: 10 }}>{t.volume}</TableCell>
                  <TableCell sx={{ fontSize: 10 }}>{t.price}</TableCell>
                  <TableCell sx={{ fontSize: 10 }}>{t.exit_price}</TableCell>
                  <TableCell sx={{ fontSize: 10, color: (t.profit || 0) >= 0 ? '#44FF44' : '#FF4444', fontWeight: 'bold' }}>${(t.profit || 0).toFixed(2)}</TableCell>
                  <TableCell sx={{ fontSize: 10, color: '#666' }}>{t.signal_source || t.source}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {trades.length === 0 && !loading && (
        <Typography sx={{ fontSize: 11, color: '#555', textAlign: 'center', py: 2 }}>Nenhuma ordem fechada ainda</Typography>
      )}
    </>
  );
}
