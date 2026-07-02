import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Typography, Chip, Grid, Card, CardContent } from '@mui/material';
import { useApp } from '../../context/AppContext';

const COLORS = {
  bg: '#0a0a0f',
  neuron: '#00ff88',
  neuronDim: '#004d29',
  connection: '#00ff8844',
  connectionStrong: '#00ff88',
  pulse: '#00ffaa',
  text: '#e0e0e0',
  textDim: '#666',
  accent: '#00ff88',
  warn: '#ffaa00',
  danger: '#ff4444',
  info: '#44aaff',
};

class NeuralNetwork {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.nodes = [];
    this.connections = [];
    this.pulses = [];
    this.time = 0;
    this.animFrame = null;
    this.learningData = null;
    this.resize();
    this.initNetwork();
  }

  resize() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.w = rect.width;
    this.h = 340;
    this.canvas.width = this.w * 2;
    this.canvas.height = this.h * 2;
    this.canvas.style.width = this.w + 'px';
    this.canvas.style.height = this.h + 'px';
    this.ctx.scale(2, 2);
  }

  initNetwork() {
    this.nodes = [];
    this.connections = [];

    const layers = [
      { count: 5, x: 0.08, label: 'ENTRADA' },
      { count: 8, x: 0.25, label: 'OCULTA 1' },
      { count: 10, x: 0.42, label: 'OCULTA 2' },
      { count: 8, x: 0.58, label: 'OCULTA 3' },
      { count: 6, x: 0.75, label: 'OCULTA 4' },
      { count: 3, x: 0.92, label: 'SAIDA' },
    ];

    const inputLabels = ['RSI', 'MACD', 'SMA', 'VOLUME', 'PRECO'];
    const outputLabels = ['COMPRAR', 'VENDER', 'AGUARDAR'];

    layers.forEach((layer, li) => {
      const spacing = this.h / (layer.count + 1);
      for (let i = 0; i < layer.count; i++) {
        const y = spacing * (i + 1);
        this.nodes.push({
          x: layer.x * this.w,
          y,
          layer: li,
          index: i,
          radius: li === 0 || li === layers.length - 1 ? 10 : 7,
          activation: 0,
          targetActivation: Math.random() * 0.3,
          pulsePhase: Math.random() * Math.PI * 2,
          label: li === 0 ? inputLabels[i] : li === layers.length - 1 ? outputLabels[i] : null,
          weight: Math.random(),
        });
      }
    });

    for (let li = 0; li < layers.length - 1; li++) {
      const fromNodes = this.nodes.filter(n => n.layer === li);
      const toNodes = this.nodes.filter(n => n.layer === li + 1);
      fromNodes.forEach(from => {
        toNodes.forEach(to => {
          if (Math.random() > 0.3) {
            this.connections.push({
              from, to,
              weight: Math.random() * 0.5 + 0.1,
              targetWeight: Math.random() * 0.5 + 0.1,
              activity: 0,
            });
          }
        });
      });
    }
  }

  setData(data) {
    this.learningData = data;
    if (!data) return;

    const accuracy = data.totalAnalyses > 0 ? data.correctPredictions / data.totalAnalyses : 0;
    const threshold = data.threshold || 0.6;

    this.nodes.forEach(n => {
      if (n.layer === 0) {
        n.targetActivation = 0.5 + Math.random() * 0.5;
      } else if (n.layer === this.nodes.length - 1) {
        n.targetActivation = accuracy;
      } else {
        n.targetActivation = accuracy * 0.7 + Math.random() * 0.3 * threshold;
      }
    });

    this.connections.forEach(c => {
      c.targetWeight = c.from.layer === 0
        ? 0.3 + Math.random() * 0.7
        : accuracy * 0.8 + Math.random() * 0.2;
    });
  }

  firePulse() {
    const inputNodes = this.nodes.filter(n => n.layer === 0);
    const source = inputNodes[Math.floor(Math.random() * inputNodes.length)];
    if (!source) return;

    this.pulses.push({
      x: source.x, y: source.y,
      targetX: source.x, targetY: source.y,
      progress: 0,
      speed: 0.008 + Math.random() * 0.008,
      color: Math.random() > 0.3 ? COLORS.neuron : COLORS.info,
      connections: this.connections.filter(c => c.from === source),
      currentConn: 0,
      path: [source],
    });
  }

  update() {
    this.time += 0.016;

    this.nodes.forEach(n => {
      n.activation += (n.targetActivation - n.activation) * 0.02;
      n.pulsePhase += 0.03;
    });

    this.connections.forEach(c => {
      c.weight += (c.targetWeight - c.weight) * 0.01;
      c.activity *= 0.98;
    });

    this.pulses.forEach(p => {
      p.progress += p.speed;
      if (p.progress >= 1 && p.currentConn < p.connections.length) {
        const conn = p.connections[p.currentConn];
        conn.activity = 1;
        const targetNode = conn.to;
        targetNode.activation = Math.min(1, targetNode.activation + 0.15);
        p.path.push(targetNode);
        p.x = targetNode.x;
        p.y = targetNode.y;
        p.currentConn++;
        if (p.currentConn < p.connections.length) {
          p.connections = this.connections.filter(c => c.from === targetNode);
          p.progress = 0;
        } else {
          p.progress = 2;
        }
      }
    });
    this.pulses = this.pulses.filter(p => p.progress < 2);

    if (Math.random() < 0.04) this.firePulse();
  }

  draw() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    const layerCount = 6;
    for (let i = 0; i < layerCount; i++) {
      const x = (i / (layerCount - 1)) * this.w * 0.84 + this.w * 0.08;
      ctx.strokeStyle = '#ffffff08';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.h);
      ctx.stroke();
    }

    this.connections.forEach(c => {
      const alpha = 0.05 + c.weight * 0.15 + c.activity * 0.4;
      ctx.strokeStyle = c.activity > 0.3
        ? `rgba(0, 255, 136, ${alpha})`
        : `rgba(0, 255, 136, ${alpha * 0.5})`;
      ctx.lineWidth = 0.5 + c.weight * 1.5 + c.activity * 2;
      ctx.beginPath();
      ctx.moveTo(c.from.x, c.from.y);
      const mx = (c.from.x + c.to.x) / 2;
      const my = (c.from.y + c.to.y) / 2 + (Math.sin(this.time + c.from.index) * 5);
      ctx.quadraticCurveTo(mx, my, c.to.x, c.to.y);
      ctx.stroke();
    });

    this.pulses.forEach(p => {
      if (p.currentConn < p.connections.length) {
        const conn = p.connections[p.currentConn];
        const t = p.progress;
        const x = p.x + (conn.to.x - p.x) * t;
        const y = p.y + (conn.to.y - p.y) * t;

        const grad = ctx.createRadialGradient(x, y, 0, x, y, 8);
        grad.addColorStop(0, p.color);
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    this.nodes.forEach(n => {
      const glow = n.activation * 0.8;
      const pulse = Math.sin(n.pulsePhase) * 0.2 + 0.8;
      const r = n.radius * (0.9 + n.activation * 0.3);

      const outerGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r * 3);
      outerGrad.addColorStop(0, `rgba(0, 255, 136, ${glow * 0.3 * pulse})`);
      outerGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = outerGrad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r * 3, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, r);
      grad.addColorStop(0, `rgba(0, 255, 136, ${0.4 + glow * 0.6})`);
      grad.addColorStop(0.7, `rgba(0, 180, 90, ${0.3 + glow * 0.4})`);
      grad.addColorStop(1, `rgba(0, 80, 40, ${0.2 + glow * 0.2})`);
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = `rgba(0, 255, 136, ${0.3 + glow * 0.5})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.stroke();

      if (n.label) {
        ctx.fillStyle = `rgba(0, 255, 136, ${0.6 + glow * 0.4})`;
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(n.label, n.x, n.y + r + 14);
      }
    });

    const layerLabels = ['ENTRADA', 'OCULTA 1', 'OCULTA 2', 'OCULTA 3', 'OCULTA 4', 'SAIDA'];
    const layerX = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92];
    ctx.fillStyle = '#ffffff22';
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    layerLabels.forEach((label, i) => {
      ctx.fillText(label, layerX[i] * this.w, 14);
    });

    if (this.learningData) {
      const d = this.learningData;
      const acc = d.totalAnalyses > 0 ? ((d.correctPredictions / d.totalAnalyses) * 100).toFixed(1) : '0.0';
      const th = ((d.threshold || 0.6) * 100).toFixed(0);
      const imp = d.improvementCount || 0;

      ctx.fillStyle = '#00ff8844';
      ctx.fillRect(8, this.h - 58, 180, 50);
      ctx.strokeStyle = '#00ff8833';
      ctx.strokeRect(8, this.h - 58, 180, 50);

      ctx.fillStyle = '#00ff88';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`ACURACIA: ${acc}%`, 16, this.h - 42);
      ctx.fillStyle = '#ffaa00';
      ctx.fillText(`LIMIAR: ${th}%`, 16, this.h - 28);
      ctx.fillStyle = '#44aaff';
      ctx.fillText(`MELHORIAS: ${imp}`, 16, this.h - 14);

      const barW = 120;
      const barX = 130;
      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(barX, this.h - 48, barW, 6);
      ctx.fillStyle = parseFloat(acc) >= 50 ? '#00ff88' : '#ff4444';
      ctx.fillRect(barX, this.h - 48, barW * (parseFloat(acc) / 100), 6);

      ctx.fillStyle = '#1a1a1e';
      ctx.fillRect(barX, this.h - 34, barW, 6);
      ctx.fillStyle = '#ffaa00';
      ctx.fillRect(barX, this.h - 34, barW * (parseFloat(th) / 100), 6);
    }
  }

  animate() {
    this.update();
    this.draw();
    this.animFrame = requestAnimationFrame(() => this.animate());
  }

  start() {
    this.animate();
  }

  stop() {
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }
}

function StatNode({ label, value, color, sub, icon }) {
  return (
    <Box sx={{
      bgcolor: '#0d0d12', border: `1px solid ${color}33`, borderRadius: 1,
      p: 1.2, textAlign: 'center', position: 'relative', overflow: 'hidden',
      '&::before': {
        content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
      },
    }}>
      <Typography sx={{ color: '#555', fontSize: 9, letterSpacing: 1 }}>{icon} {label}</Typography>
      <Typography sx={{ color, fontSize: 22, fontWeight: 'bold', fontFamily: 'monospace', lineHeight: 1.2 }}>
        {value}
      </Typography>
      {sub && <Typography sx={{ color: '#444', fontSize: 9 }}>{sub}</Typography>}
    </Box>
  );
}

function SignalBar({ label, value, max, color }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <Box sx={{ mb: 0.8 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.3 }}>
        <Typography sx={{ color: '#666', fontSize: 9, fontFamily: 'monospace' }}>{label}</Typography>
        <Typography sx={{ color, fontSize: 9, fontFamily: 'monospace' }}>{typeof value === 'number' ? value.toFixed(2) : value}</Typography>
      </Box>
      <Box sx={{ height: 3, bgcolor: '#1a1a1e', borderRadius: 1, overflow: 'hidden' }}>
        <Box sx={{ height: '100%', width: `${Math.min(pct, 100)}%`, bgcolor: color, transition: 'width 0.5s', borderRadius: 1 }} />
      </Box>
    </Box>
  );
}

function NeuronActivity({ pair, data }) {
  const wr = data.total > 0 ? (data.wins / data.total) * 100 : 0;
  const profit = (data.totalProfit || 0) + (data.totalLoss || 0);
  const isActive = data.total > 0;
  const pulseColor = wr >= 60 ? '#00ff88' : wr >= 45 ? '#ffaa00' : '#ff4444';

  return (
    <Box sx={{
      bgcolor: '#0d0d12', border: `1px solid ${isActive ? pulseColor + '33' : '#222'}`,
      borderRadius: 1, p: 1, position: 'relative',
      animation: isActive ? 'pulse 2s infinite' : 'none',
      '@keyframes pulse': {
        '0%, 100%': { borderColor: pulseColor + '22' },
        '50%': { borderColor: pulseColor + '66' },
      },
    }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
        <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: pulseColor, boxShadow: `0 0 6px ${pulseColor}` }} />
        <Typography sx={{ color: '#fff', fontSize: 10, fontWeight: 'bold' }}>{pair}</Typography>
        <Typography sx={{ color: '#444', fontSize: 9, ml: 'auto' }}>{data.total} ops</Typography>
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Box>
          <Typography sx={{ color: '#555', fontSize: 8 }}>TA</Typography>
          <Typography sx={{ color: wr >= 50 ? '#00ff88' : '#ff4444', fontSize: 12, fontFamily: 'monospace' }}>
            {wr.toFixed(0)}%
          </Typography>
        </Box>
        <Box>
          <Typography sx={{ color: '#555', fontSize: 8 }}>P/L</Typography>
          <Typography sx={{ color: profit >= 0 ? '#00ff88' : '#ff4444', fontSize: 12, fontFamily: 'monospace' }}>
            ${profit.toFixed(0)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

export default function SelfImproveTab() {
  const { socket, pairs } = useApp();
  const canvasRef = useRef(null);
  const networkRef = useRef(null);
  const terminalRef = useRef(null);
  const [stats, setStats] = useState(null);
  const [strategyPerf, setStrategyPerf] = useState({});
  const [analysis, setAnalysis] = useState(null);
  const [weeklyReport, setWeeklyReport] = useState(null);
  const [threshold, setThreshold] = useState(0.6);
  const [loading, setLoading] = useState(true);
  const [activeLayer, setActiveLayer] = useState(0);
  const [cotPair, setCotPair] = useState('EURUSD');
  const [cotRunning, setCotRunning] = useState(false);
  const [cotResult, setCotResult] = useState(null);
  const [terminalLines, setTerminalLines] = useState([]);
  const [currentLine, setCurrentLine] = useState('');
  const [typingDone, setTypingDone] = useState(false);

  const api = async (path, opts = {}) => {
    const token = localStorage.getItem('ukulotrade_token');
    const res = await fetch(path, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...opts });
    return res.json();
  };

  async function runChainOfThought() {
    if (cotRunning) return;
    setCotRunning(true);
    setCotResult(null);
    setTerminalLines([]);
    setCurrentLine('');
    setTypingDone(false);

    setTerminalLines([
      { text: `> Iniciando analise LLM para ${cotPair}...`, color: '#00ff88' },
      { text: '> Conectando ao motor de raciocinio...', color: '#666' },
    ]);

    try {
      const result = await api('/api/llm/chain-of-thought', {
        method: 'POST',
        body: JSON.stringify({ pair: cotPair }),
      });

      if (!result.ok) {
        setTerminalLines(prev => [...prev, { text: `> ERRO: ${result.error}`, color: '#ff4444' }]);
        setCotRunning(false);
        return;
      }

      setTerminalLines(prev => [...prev,
        { text: `> Modelo: ${result.model} | Estrategia: ${result.strategy}`, color: '#44aaff' },
        { text: `> Tempo de resposta: ${result.elapsed}ms`, color: '#666' },
        { text: '', color: '#666' },
        { text: '═══════════════════════════════════════════════════', color: '#333' },
        { text: '  RACIOCINIO DO LLM', color: '#00ff88', bold: true },
        { text: '═══════════════════════════════════════════════════', color: '#333' },
      ]);

      const rawLines = result.raw.split('\n');
      for (let i = 0; i < rawLines.length; i++) {
        await new Promise(r => setTimeout(r, 30 + Math.random() * 20));
        setTerminalLines(prev => [...prev, { text: rawLines[i], color: '#ccc' }]);
      }

      setTerminalLines(prev => [...prev,
        { text: '', color: '#666' },
        { text: '═══════════════════════════════════════════════════', color: '#333' },
        { text: '  RESULTADO PARCIAL', color: '#ffaa00', bold: true },
        { text: '═══════════════════════════════════════════════════', color: '#333' },
        { text: `  Decisao: ${result.parsed.action.toUpperCase()}`, color: result.parsed.action === 'buy' ? '#00ff88' : result.parsed.action === 'sell' ? '#ff4444' : '#ffaa00' },
        { text: `  Confianca: ${(result.parsed.confidence * 100).toFixed(0)}%`, color: '#ffaa00' },
        { text: `  Motivo: ${result.parsed.reason?.slice(0, 120)}`, color: '#aaa' },
      ]);

      if (result.parsed.entry_price) {
        setTerminalLines(prev => [...prev,
          { text: `  Entry: ${result.parsed.entry_price}`, color: '#44aaff' },
          { text: `  SL: ${result.parsed.stop_loss} pips | TP: ${result.parsed.take_profit} pips`, color: '#44aaff' },
        ]);
      }

      setTerminalLines(prev => [...prev,
        { text: '', color: '#666' },
        { text: '> Analise concluida.', color: '#00ff88' },
      ]);

      setCotResult(result);

      if (networkRef.current) {
        networkRef.current.firePulse();
        networkRef.current.firePulse();
        networkRef.current.firePulse();
      }
    } catch (e) {
      setTerminalLines(prev => [...prev, { text: `> ERRO: ${e.message}`, color: '#ff4444' }]);
    }
    setCotRunning(false);
    setTypingDone(true);
  }

  async function fetchAll() {
    setLoading(true);
    try {
      const [statsRes, perfRes, analysisRes, weeklyRes, threshRes] = await Promise.all([
        api('/api/llm/self-improve/stats'),
        api('/api/llm/self-improve/strategy-performance'),
        api('/api/llm/self-improve/analyze'),
        api('/api/llm/self-improve/weekly-report'),
        api('/api/llm/self-improve/threshold'),
      ]);
      setStats(statsRes);
      setStrategyPerf(perfRes);
      setAnalysis(analysisRes);
      setWeeklyReport(weeklyRes);
      setThreshold(threshRes.threshold || 0.6);

      if (networkRef.current) {
        networkRef.current.setData({
          totalAnalyses: statsRes?.totalAnalyses || 0,
          correctPredictions: statsRes?.correctPredictions || 0,
          threshold: threshRes.threshold || 0.6,
          improvementCount: statsRes?.improvementCount || 0,
        });
      }
    } catch (e) {
      console.error('Erro ao buscar dados:', e);
    }
    setLoading(false);
  }

  useEffect(() => {
    fetchAll();
  }, []);

  useEffect(() => {
    if (!canvasRef.current) return;
    const net = new NeuralNetwork(canvasRef.current);
    networkRef.current = net;
    net.start();

    const handleResize = () => net.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      net.stop();
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useEffect(() => {
    if (!socket) return;
    const handler = (data) => {
      if (networkRef.current && data) {
        networkRef.current.firePulse();
      }
    };
    socket.on('llm-analysis', handler);
    socket.on('auto-trade-log', handler);
    return () => {
      socket.off('llm-analysis', handler);
      socket.off('auto-trade-log', handler);
    };
  }, [socket]);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveLayer(prev => (prev + 1) % 6);
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  const accuracy = stats?.totalAnalyses > 0
    ? ((stats.correctPredictions / stats.totalAnalyses) * 100).toFixed(1)
    : '0.0';

  const recentErrors = stats?.commonMistakes?.filter(
    m => Date.now() - m.time < 7 * 24 * 60 * 60 * 1000
  ).length || 0;

  const pairPerf = {};
  if (strategyPerf && typeof strategyPerf === 'object') {
    Object.entries(strategyPerf).forEach(([pair, strategies]) => {
      let totalT = 0, totalW = 0, totalP = 0;
      Object.values(strategies).forEach(s => {
        totalT += s.total || 0;
        totalW += s.wins || 0;
        totalP += (s.totalProfit || 0) + (s.totalLoss || 0);
      });
      pairPerf[pair] = { total: totalT, wins: totalW, profit: totalP };
    });
  }

  return (
    <Box sx={{ p: 1, bgcolor: '#0a0a0f', minHeight: '100vh' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
        <Box sx={{
          width: 8, height: 8, borderRadius: '50%', bgcolor: '#00ff88',
          boxShadow: '0 0 10px #00ff88, 0 0 20px #00ff8844',
          animation: 'glow 2s infinite',
          '@keyframes glow': {
            '0%, 100%': { boxShadow: '0 0 10px #00ff88, 0 0 20px #00ff8844' },
            '50%': { boxShadow: '0 0 15px #00ff88, 0 0 30px #00ff8866' },
          },
        }} />
        <Typography sx={{ color: '#00ff88', fontSize: 14, fontWeight: 'bold', fontFamily: 'monospace', letterSpacing: 1 }}>
          REDE NEURAL - MOTOR DE AUTO-APRIMORAMENTO
        </Typography>
        <Chip label="AO VIVO" size="small" sx={{
          bgcolor: '#00ff8822', color: '#00ff88', fontSize: 9, fontWeight: 'bold',
          border: '1px solid #00ff8844', ml: 'auto',
        }} />
      </Box>

      <Box sx={{
        border: '1px solid #00ff8822', borderRadius: 1, overflow: 'hidden', mb: 1.5,
        bgcolor: '#0a0a0f', position: 'relative',
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%' }} />
        <Box sx={{
          position: 'absolute', top: 8, right: 8, bgcolor: '#0a0a0fdd',
          border: '1px solid #00ff8833', borderRadius: 1, p: 1,
        }}>
          <Typography sx={{ color: '#00ff88', fontSize: 8, fontFamily: 'monospace', mb: 0.5 }}>SINAIS DE APRENDIZADO</Typography>
          {['ENTRADA', 'OCULTA 1', 'OCULTA 2', 'OCULTA 3', 'OCULTA 4', 'SAIDA'].map((name, i) => (
            <Box key={name} sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.3 }}>
              <Box sx={{
                width: 4, height: 4, borderRadius: '50%',
                bgcolor: i === activeLayer ? '#00ff88' : '#333',
                boxShadow: i === activeLayer ? '0 0 6px #00ff88' : 'none',
                transition: 'all 0.3s',
              }} />
              <Typography sx={{ color: i === activeLayer ? '#00ff88' : '#444', fontSize: 7, fontFamily: 'monospace' }}>
                {name}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{
        bgcolor: '#0d0d12', border: '1px solid #00ff8822', borderRadius: 1, mb: 1.5,
        overflow: 'hidden',
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, borderBottom: '1px solid #00ff8815' }}>
          <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: cotRunning ? '#ffaa00' : '#00ff88',
            boxShadow: cotRunning ? '0 0 8px #ffaa00' : '0 0 6px #00ff88',
            animation: cotRunning ? 'blink 0.8s infinite' : 'none',
            '@keyframes blink': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0.3 } },
          }} />
          <Typography sx={{ color: '#00ff88', fontSize: 10, fontFamily: 'monospace', letterSpacing: 1 }}>
            CHAIN-OF-THOUGHT - RACIOCINIO LLM
          </Typography>
          <Box sx={{ flex: 1 }} />
          <select value={cotPair} onChange={e => setCotPair(e.target.value)}
            style={{
              bgcolor: '#1a1a1e', color: '#00ff88', border: '1px solid #00ff8833',
              borderRadius: 4, padding: '4px 8px', fontSize: 11, fontFamily: 'monospace',
              outline: 'none',
            }}>
            {(pairs || ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD', 'XAUUSD']).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
          <Chip label={cotRunning ? 'ANALISANDO...' : 'ANALISAR'} onClick={runChainOfThought} clickable
            disabled={cotRunning} sx={{
              bgcolor: cotRunning ? '#ffaa0022' : '#00ff8822',
              color: cotRunning ? '#ffaa00' : '#00ff88',
              fontSize: 9, fontWeight: 'bold', fontFamily: 'monospace',
              border: `1px solid ${cotRunning ? '#ffaa0044' : '#00ff8844'}`,
              cursor: cotRunning ? 'wait' : 'pointer',
              '&:hover': { bgcolor: cotRunning ? '#ffaa0022' : '#00ff8833' },
            }} />
        </Box>

        <Box ref={terminalRef} sx={{
          height: 300, overflow: 'auto', p: 1, fontFamily: 'monospace', fontSize: 10,
          bgcolor: '#080810', lineHeight: 1.6,
          '&::-webkit-scrollbar': { width: 4 },
          '&::-webkit-scrollbar-track': { bgcolor: '#0a0a0f' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#00ff8833', borderRadius: 2 },
        }}>
          {terminalLines.length === 0 && !cotRunning && (
            <Typography sx={{ color: '#333', fontSize: 11, textAlign: 'center', mt: 8 }}>
              Selecione um par e clique em ANALISAR para ver o raciocinio do LLM em tempo real
            </Typography>
          )}
          {terminalLines.map((line, i) => (
            <Box key={i} sx={{ display: 'flex', gap: 1 }}>
              <Typography sx={{
                color: '#333', fontSize: 9, minWidth: 24, textAlign: 'right', userSelect: 'none',
              }}>
                {String(i + 1).padStart(2, '0')}
              </Typography>
              <Typography sx={{
                color: line.color || '#ccc',
                fontSize: line.bold ? 11 : 10,
                fontWeight: line.bold ? 'bold' : 'normal',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              }}>
                {line.text}
              </Typography>
            </Box>
          ))}
          {cotRunning && (
            <Box sx={{ display: 'flex', gap: 1, mt: 0.5 }}>
              <Typography sx={{ color: '#333', fontSize: 9, minWidth: 24, textAlign: 'right' }}>
                {String(terminalLines.length + 1).padStart(2, '0')}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box sx={{ width: 6, height: 12, bgcolor: '#00ff88', animation: 'cursor 0.8s infinite',
                  '@keyframes cursor': { '0%, 100%': { opacity: 1 }, '50%': { opacity: 0 } } }} />
              </Box>
            </Box>
          )}
        </Box>

        {cotResult && (
          <Box sx={{ p: 1, borderTop: '1px solid #00ff8815', display: 'flex', gap: 2, alignItems: 'center' }}>
            <Chip label={`${cotResult.pair}`} size="small" sx={{ bgcolor: '#00ff8811', color: '#00ff88', fontSize: 10, fontWeight: 'bold' }} />
            <Chip label={cotResult.parsed.action.toUpperCase()} size="small" sx={{
              bgcolor: cotResult.parsed.action === 'buy' ? '#00ff8822' : cotResult.parsed.action === 'sell' ? '#ff444422' : '#ffaa0022',
              color: cotResult.parsed.action === 'buy' ? '#00ff88' : cotResult.parsed.action === 'sell' ? '#ff4444' : '#ffaa00',
              fontSize: 10, fontWeight: 'bold', border: `1px solid ${cotResult.parsed.action === 'buy' ? '#00ff8844' : cotResult.parsed.action === 'sell' ? '#ff444444' : '#ffaa0044'}`,
            }} />
            <Typography sx={{ color: '#ffaa00', fontSize: 10, fontFamily: 'monospace' }}>
              Conf: {(cotResult.parsed.confidence * 100).toFixed(0)}%
            </Typography>
            {cotResult.parsed.entry_price && (
              <Typography sx={{ color: '#44aaff', fontSize: 10, fontFamily: 'monospace' }}>
                Entry: {cotResult.parsed.entry_price} | SL: {cotResult.parsed.stop_loss}p | TP: {cotResult.parsed.take_profit}p
              </Typography>
            )}
            <Typography sx={{ color: '#444', fontSize: 9, ml: 'auto' }}>
              {cotResult.elapsed}ms | {cotResult.model}
            </Typography>
          </Box>
        )}
      </Box>

      <Grid container spacing={1} sx={{ mb: 1.5 }}>
        <Grid item xs={3}>
          <StatNode label="ACURACIA" value={`${accuracy}%`} color={parseFloat(accuracy) >= 50 ? '#00ff88' : '#ff4444'} sub={`${stats?.correctPredictions || 0}/${stats?.totalAnalyses || 0}`} icon="◎" />
        </Grid>
        <Grid item xs={3}>
          <StatNode label="LIMIAR" value={`${(threshold * 100).toFixed(0)}%`} color="#ffaa00" sub="Adaptativo" icon="◆" />
        </Grid>
        <Grid item xs={3}>
          <StatNode label="MELHORIAS" value={stats?.improvementCount || 0} color="#44aaff" sub="Ajustes aplicados" icon="▲" />
        </Grid>
        <Grid item xs={3}>
          <StatNode label="ERROS (7d)" value={recentErrors} color="#ff4444" sub="Padroes detectados" icon="✕" />
        </Grid>
      </Grid>

      {weeklyReport && weeklyReport.totalTrades > 0 && (
        <Box sx={{
          bgcolor: '#0d0d12', border: '1px solid #00ff8822', borderRadius: 1, p: 1.5, mb: 1.5,
          position: 'relative', overflow: 'hidden',
          '&::before': {
            content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 1,
            background: 'linear-gradient(90deg, transparent, #00ff88, transparent)',
          },
        }}>
          <Typography sx={{ color: '#00ff88', fontSize: 10, fontFamily: 'monospace', mb: 1, letterSpacing: 1 }}>
            ◈ RELATORIO SEMANAL DE DESEMPENHO
          </Typography>
          <Grid container spacing={1}>
            <Grid item xs={3}>
              <SignalBar label="OPERACOES" value={weeklyReport.totalTrades} max={50} color="#44aaff" />
            </Grid>
            <Grid item xs={3}>
              <SignalBar label="TAXA DE ACERTO" value={weeklyReport.winRate} max={100} color={weeklyReport.winRate >= 50 ? '#00ff88' : '#ff4444'} />
            </Grid>
            <Grid item xs={3}>
              <SignalBar label="LUCRO" value={weeklyReport.totalProfit} max={Math.abs(weeklyReport.totalProfit) * 2 || 100} color={weeklyReport.totalProfit >= 0 ? '#00ff88' : '#ff4444'} />
            </Grid>
            <Grid item xs={3}>
              <SignalBar label="FATOR DE LUCRO" value={weeklyReport.profitFactor} max={5} color={weeklyReport.profitFactor >= 1 ? '#00ff88' : '#ff4444'} />
            </Grid>
          </Grid>
          {weeklyReport.bySource && Object.keys(weeklyReport.bySource).length > 0 && (
            <Box sx={{ mt: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {Object.entries(weeklyReport.bySource).map(([source, data]) => (
                <Chip key={source}
                  label={`${source}: ${data.count} ops (${((data.wins / data.count) * 100).toFixed(0)}% TA) $${data.profit.toFixed(2)}`}
                  size="small" sx={{
                    bgcolor: data.wins / data.count >= 0.5 ? '#00ff8811' : '#ff444411',
                    color: data.wins / data.count >= 0.5 ? '#00ff88' : '#ff4444',
                    fontSize: 9, border: `1px solid ${data.wins / data.count >= 0.5 ? '#00ff8833' : '#ff444433'}`,
                  }} />
              ))}
            </Box>
          )}
        </Box>
      )}

      {Object.keys(pairPerf).length > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Typography sx={{ color: '#00ff88', fontSize: 10, fontFamily: 'monospace', mb: 1, letterSpacing: 1 }}>
            ◈ ATIVIDADE DOS NEURIOS POR PAR
          </Typography>
          <Grid container spacing={1}>
            {Object.entries(pairPerf).map(([pair, data]) => (
              <Grid item xs={6} md={3} key={pair}>
                <NeuronActivity pair={pair} data={data} />
              </Grid>
            ))}
          </Grid>
        </Box>
      )}

      {analysis && analysis.insights && analysis.insights.length > 0 && (
        <Box sx={{
          bgcolor: '#0d0d12', border: '1px solid #00ff8822', borderRadius: 1, p: 1.5, mb: 1.5,
        }}>
          <Typography sx={{ color: '#00ff88', fontSize: 10, fontFamily: 'monospace', mb: 1, letterSpacing: 1 }}>
            ◈ INSIGHTS DE APRENDIZADO ({analysis.analyzed} operacoes analisadas)
          </Typography>
          {analysis.insights.map((insight, i) => {
            const colors = {
              strong_pair: '#00ff88', weak_pair: '#ffaa00',
              repeated_mistake: '#ff4444', info: '#44aaff',
            };
            const icons = { strong_pair: '▲', weak_pair: '◆', repeated_mistake: '✕', info: '●' };
            const c = colors[insight.type] || '#44aaff';
            return (
              <Box key={i} sx={{
                display: 'flex', alignItems: 'flex-start', gap: 1, mb: 0.8,
                bgcolor: c + '08', border: `1px solid ${c}22`, borderRadius: 0.5, p: 0.8,
              }}>
                <Typography sx={{ color: c, fontSize: 12, mt: 0.2 }}>{icons[insight.type] || '●'}</Typography>
                <Typography sx={{ color: '#aaa', fontSize: 10, lineHeight: 1.4 }}>{insight.recommendation}</Typography>
              </Box>
            );
          })}
        </Box>
      )}

      {stats?.commonMistakes && stats.commonMistakes.length > 0 && (
        <Box sx={{
          bgcolor: '#0d0d12', border: '1px solid #ff444422', borderRadius: 1, p: 1.5, mb: 1.5,
        }}>
          <Typography sx={{ color: '#ff4444', fontSize: 10, fontFamily: 'monospace', mb: 1, letterSpacing: 1 }}>
            ◈ ERROS RECENTES - CORRECAO DE PADRAO
          </Typography>
          {stats.commonMistakes.slice(-8).reverse().map((m, i) => (
            <Box key={i} sx={{
              display: 'flex', alignItems: 'center', gap: 1, mb: 0.5,
              bgcolor: '#ff444408', border: '1px solid #ff444415', borderRadius: 0.5, p: 0.6,
            }}>
              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: '#ff4444', boxShadow: '0 0 4px #ff4444' }} />
              <Chip label={m.pair} size="small" sx={{ bgcolor: '#1a1a1e', fontSize: 9, height: 18 }} />
              <Chip label={m.action?.toUpperCase()} size="small" sx={{
                bgcolor: m.action === 'buy' ? '#00ff8811' : '#ff444411',
                color: m.action === 'buy' ? '#00ff88' : '#ff4444',
                fontSize: 9, height: 18, border: `1px solid ${m.action === 'buy' ? '#00ff8833' : '#ff444433'}`,
              }} />
              <Typography sx={{ color: '#ff4444', fontSize: 10, fontFamily: 'monospace' }}>${m.profit?.toFixed(2)}</Typography>
              <Typography sx={{ color: '#444', fontSize: 8, ml: 'auto' }}>
                conf: {((m.confidence || 0) * 100).toFixed(0)}% | {m.reason?.slice(0, 40)}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      <Box sx={{ textAlign: 'center', mt: 1 }}>
        <Chip label="⟐ RECARREGAR DADOS" onClick={fetchAll} clickable sx={{
          bgcolor: '#00ff8811', color: '#00ff88', fontSize: 10, fontFamily: 'monospace',
          border: '1px solid #00ff8833', cursor: 'pointer',
          '&:hover': { bgcolor: '#00ff8822', borderColor: '#00ff8866' },
        }} />
      </Box>
    </Box>
  );
}
