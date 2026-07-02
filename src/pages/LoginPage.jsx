import { useState, useEffect, useRef } from 'react';
import { Box, TextField, Button, Typography, Alert, Link, CircularProgress, Paper, Checkbox, FormControlLabel, Divider, IconButton, InputAdornment } from '@mui/material';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { icon: '⚡', title: 'Auto Trading', desc: 'Operacoes automaticas com IA 24/7 nos principais pares de forex' },
  { icon: '🤖', title: 'Analise LLM', desc: 'Sinais gerados por modelos de linguagem com estrategia ICT/SMC' },
  { icon: '📊', title: 'Multi-Pares', desc: 'Monitoramento simultaneo de EURUSD, GBPUSD, USDJPY e mais' },
  { icon: '🛡️', title: 'Protecao Inteligente', desc: 'Stop loss, take profit e gerenciamento de risco por IA' },
  { icon: '📈', title: 'MetaTrader 5', desc: 'Integracao direta com MT5 para execucao instantanea de ordens' },
  { icon: '🔐', title: 'Multi-Conta', desc: 'Gerencie varias contas de trading em um unico painel' },
];

function UkuloLogo({ size = 'normal' }) {
  const s = size === 'large' ? 48 : 32;
  const fs = size === 'large' ? 22 : 15;
  const ts = size === 'large' ? 20 : 17;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
      <Box sx={{
        width: s, height: s, borderRadius: '10px', position: 'relative',
        background: 'linear-gradient(135deg, #44FF44 0%, #22AA22 100%)',
        boxShadow: '0 0 20px rgba(68,255,68,0.3), inset 0 1px 0 rgba(255,255,255,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        '&::before': { content: '""', position: 'absolute', inset: -2, borderRadius: '12px', border: '1px solid rgba(68,255,68,0.3)', pointerEvents: 'none' },
        '&::after': { content: '""', position: 'absolute', top: 2, left: 2, right: '50%', bottom: '50%', borderRadius: '6px 2px 8px 2px', background: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, transparent 60%)', pointerEvents: 'none' },
      }}>
        <Typography sx={{ color: '#000', fontWeight: 900, fontSize: fs, fontFamily: 'monospace', letterSpacing: -1 }}>U</Typography>
      </Box>
      <Box>
        <Typography sx={{ color: '#44FF44', fontWeight: 900, fontSize: ts, letterSpacing: 1.5, fontFamily: 'monospace', lineHeight: 1 }}>
          Ukulo<span style={{ color: '#fff' }}>Trade</span>
        </Typography>
        {size === 'large' && <Typography sx={{ color: '#333', fontSize: 9, letterSpacing: 3, fontFamily: 'monospace', mt: 0.3 }}>AI TRADING PLATFORM</Typography>}
      </Box>
    </Box>
  );
}

function AIBotCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    let id, t = 0;
    const W = c.width = 380, H = c.height = 520;

    function drawBot(cx, cy, time) {
      const bob = Math.sin(time * 0.025) * 5;
      const g = 0.4 + Math.sin(time * 0.04) * 0.1;
      ctx.save(); ctx.translate(cx, cy + bob);

      ctx.globalAlpha = g * 0.08;
      const og = ctx.createRadialGradient(0, 0, 10, 0, 0, 180);
      og.addColorStop(0, 'rgba(68,255,68,0.12)'); og.addColorStop(1, 'rgba(68,255,68,0)');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(0, 0, 180, 0, Math.PI * 2); ctx.fill();

      ctx.globalAlpha = g * 0.2;
      for (let i = 0; i < 5; i++) {
        const r = 100 + i * 22 + Math.sin(time * 0.012 + i) * 8;
        ctx.beginPath(); ctx.ellipse(0, 25, r, r * 0.18, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(68,255,68,${0.12 - i * 0.02})`; ctx.lineWidth = 0.5; ctx.stroke();
      }

      ctx.globalAlpha = g * 0.45; ctx.strokeStyle = 'rgba(68,255,68,0.45)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(0, 12, 55, 78, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.globalAlpha = g * 0.18; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.ellipse(0, 12, 51, 74, 0, 0, Math.PI * 2); ctx.stroke();

      ctx.globalAlpha = g * 0.25; ctx.lineWidth = 0.4;
      for (let i = 0; i < 13; i++) { const ny = -60 + i * 11; ctx.beginPath(); ctx.moveTo(-48, ny); ctx.lineTo(48, ny); ctx.stroke(); }
      for (let i = 0; i < 9; i++) { const nx = -42 + i * 10; ctx.beginPath(); ctx.moveTo(nx, -65); ctx.lineTo(nx, 85); ctx.stroke(); }

      const ey = -18, bl = Math.sin(time * 0.06) > 0.97 ? 0.1 : 1;
      [-20, 20].forEach(ex => {
        ctx.globalAlpha = g;
        ctx.beginPath(); ctx.ellipse(ex, ey, 9, 6 * bl, 0, 0, Math.PI * 2); ctx.fillStyle = '#44FF44'; ctx.fill();
        ctx.beginPath(); ctx.arc(ex, ey, 14, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(68,255,68,0.25)'; ctx.lineWidth = 0.5; ctx.stroke();
        ctx.beginPath(); ctx.arc(ex, ey, 18, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(68,255,68,0.1)'; ctx.stroke();
      });

      ctx.globalAlpha = g * 0.7; ctx.beginPath(); ctx.moveTo(-12, 5); ctx.lineTo(12, 5); ctx.strokeStyle = '#44FF44'; ctx.lineWidth = 1.5; ctx.stroke();
      const mo = Math.abs(Math.sin(time * 0.035)) * 3;
      ctx.globalAlpha = g * 0.45; ctx.beginPath(); ctx.moveTo(-10, 12); ctx.quadraticCurveTo(0, 12 + mo, 10, 12); ctx.strokeStyle = '#44FF44'; ctx.lineWidth = 1; ctx.stroke();

      ctx.globalAlpha = g * 0.35; ctx.strokeStyle = 'rgba(68,255,68,0.3)'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.moveTo(-56, 12); ctx.quadraticCurveTo(-70, -20, -52, -68); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(56, 12); ctx.quadraticCurveTo(70, -20, 52, -68); ctx.stroke();

      const aw = Math.sin(time * 0.05) * 9;
      ctx.globalAlpha = g * 0.55; ctx.beginPath(); ctx.moveTo(0, -65); ctx.quadraticCurveTo(aw * 0.5, -88, aw, -100);
      ctx.strokeStyle = 'rgba(68,255,68,0.5)'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.beginPath(); ctx.arc(aw, -103, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#44FF44'; ctx.fill();
      ctx.globalAlpha = g * 0.12; ctx.beginPath(); ctx.arc(aw, -103, 10 + Math.sin(time * 0.08) * 4, 0, Math.PI * 2); ctx.fillStyle = 'rgba(68,255,68,0.15)'; ctx.fill();

      ctx.globalAlpha = g * 0.3; ctx.strokeStyle = 'rgba(68,255,68,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-30, 85); ctx.lineTo(-36, 130); ctx.lineTo(-46, 138); ctx.moveTo(-36, 130); ctx.lineTo(-22, 138); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(30, 85); ctx.lineTo(36, 130); ctx.lineTo(22, 138); ctx.moveTo(36, 130); ctx.lineTo(46, 138); ctx.stroke();

      ctx.globalAlpha = g * 0.5;
      for (let i = 0; i < 4; i++) {
        const hy = -40 + i * 24;
        ctx.beginPath(); ctx.arc(38, hy, 3 + Math.sin(time * 0.08 + i) * 1.2, 0, Math.PI * 2);
        ctx.fillStyle = i === 2 ? '#FFAA00' : '#44FF44'; ctx.fill();
      }
      ctx.restore();
    }

    function draw() {
      ctx.clearRect(0, 0, W, H);
      drawBot(W / 2, H / 2 + 10, t);
      ctx.globalAlpha = 0.06 + Math.sin(t * 0.02) * 0.02;
      ctx.font = '10px monospace'; ctx.fillStyle = '#44FF44'; ctx.textAlign = 'left';
      ['> LLM Engine v3.2', '> ICT/SMC: ON', '> Auto-Trade: ACTIVE', '> Risk: ENABLED', '> Pairs: 7/7', '> Win: 68.4%', '> Latency: 12ms'].forEach((l, i) => {
        if (Math.floor((t * 0.015 + i * 4) % 12) > i) ctx.fillText(l, 12, 28 + i * 16);
      });
      t++; id = requestAnimationFrame(draw);
    }
    draw(); return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={canvasRef} style={{ width: 380, height: 520, opacity: 0.85 }} />;
}

function LLMNeuralCanvas() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    let id, t = 0;
    const W = c.width = 380, H = c.height = 520;

    function draw() {
      ctx.clearRect(0, 0, W, H);
      const g = 0.35 + Math.sin(t * 0.03) * 0.08;
      const cx = W / 2, cy = H / 2 - 10;

      ctx.globalAlpha = g * 0.1;
      const og = ctx.createRadialGradient(cx, cy, 10, cx, cy, 170);
      og.addColorStop(0, 'rgba(68,255,68,0.12)'); og.addColorStop(1, 'rgba(68,255,68,0)');
      ctx.fillStyle = og; ctx.beginPath(); ctx.arc(cx, cy, 170, 0, Math.PI * 2); ctx.fill();

      ctx.globalAlpha = g * 0.2; ctx.strokeStyle = 'rgba(68,255,68,0.12)'; ctx.lineWidth = 0.4;
      for (let r = 35; r <= 150; r += 28) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); }

      const nodes = [];
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 / 10) * i + t * 0.008;
        const r = 95 + Math.sin(t * 0.02 + i * 0.7) * 18;
        nodes.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r });
      }
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const d = Math.hypot(nodes[i].x - nodes[j].x, nodes[i].y - nodes[j].y);
          if (d < 130) {
            ctx.globalAlpha = g * 0.12 * (1 - d / 130);
            ctx.beginPath(); ctx.moveTo(nodes[i].x, nodes[i].y); ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.strokeStyle = '#44FF44'; ctx.lineWidth = 0.7; ctx.stroke();
          }
        }
      }
      for (const n of nodes) {
        ctx.globalAlpha = g * 0.6; ctx.beginPath(); ctx.arc(n.x, n.y, 3.5, 0, Math.PI * 2); ctx.fillStyle = '#44FF44'; ctx.fill();
        ctx.beginPath(); ctx.arc(n.x, n.y, 7, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(68,255,68,0.2)'; ctx.lineWidth = 0.4; ctx.stroke();
      }

      ctx.globalAlpha = g * 0.8; ctx.font = 'bold 15px monospace'; ctx.fillStyle = '#44FF44'; ctx.textAlign = 'center';
      ctx.fillText('LLM', cx, cy + 5);
      ctx.globalAlpha = g * 0.12; ctx.beginPath(); ctx.arc(cx, cy, 22 + Math.sin(t * 0.04) * 4, 0, Math.PI * 2);
      const gr = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26); gr.addColorStop(0, 'rgba(68,255,68,0.25)'); gr.addColorStop(1, 'rgba(68,255,68,0)'); ctx.fillStyle = gr; ctx.fill();

      const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];
      const acts = ['BUY', 'SELL', 'WAIT', 'BUY', 'SELL', 'WAIT', 'BUY'];
      const confs = [82, 71, 0, 65, 88, 0, 73];
      ctx.font = '9px monospace';
      pairs.forEach((p, i) => {
        const a = (Math.PI * 2 / 7) * i + t * 0.005;
        const r = 145 + Math.sin(t * 0.02 + i) * 6;
        const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r;
        const isB = acts[i] === 'BUY', isS = acts[i] === 'SELL';
        const col = isB ? '#44FF44' : isS ? '#FF4444' : '#555';
        ctx.globalAlpha = g * 0.4; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 30, cy + Math.sin(a) * 30); ctx.lineTo(px, py);
        ctx.strokeStyle = `rgba(68,255,68,${isB || isS ? 0.12 : 0.04})`; ctx.lineWidth = 0.4; ctx.stroke();
        ctx.globalAlpha = g * 0.65; ctx.fillStyle = col; ctx.textAlign = 'center'; ctx.fillText(p, px, py - 5);
        if (confs[i] > 0) { ctx.globalAlpha = g * 0.45; ctx.fillText(`${acts[i]} ${confs[i]}%`, px, py + 7); }
      });

      ctx.globalAlpha = g * 0.12; ctx.font = '8px monospace'; ctx.fillStyle = '#44FF44'; ctx.textAlign = 'left';
      ['> Analyzing EURUSD...', '> ICT/SMC: Bullish OB', '> Confidence: 82%', '> Signal: BUY', '> SL: 1.08100', '> TP: 1.08900', '> Order sent MT5', '> #4521 opened'].forEach((l, i) => {
        if (Math.floor((t * 0.012 + i * 5) % 12) > i) ctx.fillText(l, 12, H - 72 + i * 11);
      });

      t++; id = requestAnimationFrame(draw);
    }
    draw(); return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={canvasRef} style={{ width: 380, height: 520, opacity: 0.8 }} />;
}

function HoloScanLine() {
  const [pos, setPos] = useState(0);
  useEffect(() => { const iv = setInterval(() => setPos(p => (p + 1) % 100), 30); return () => clearInterval(iv); }, []);
  return (
    <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 0 }}>
      <Box sx={{ position: 'absolute', top: `${pos}%`, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(68,255,68,0.15), transparent)', filter: 'blur(1px)' }} />
    </Box>
  );
}

function ParticleField() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); let id;
    const W = c.width = window.innerWidth, H = c.height = window.innerHeight;
    const ps = Array.from({ length: 40 }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.2, vy: (Math.random() - 0.5) * 0.2, r: Math.random() * 1.3 + 0.4 }));
    function draw() {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) { p.x += p.vx; p.y += p.vy; if (p.x < 0) p.x = W; if (p.x > W) p.x = 0; if (p.y < 0) p.y = H; if (p.y > H) p.y = 0; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fillStyle = 'rgba(68,255,68,0.07)'; ctx.fill(); }
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) { const d = Math.hypot(ps[i].x - ps[j].x, ps[i].y - ps[j].y); if (d < 85) { ctx.beginPath(); ctx.moveTo(ps[i].x, ps[i].y); ctx.lineTo(ps[j].x, ps[j].y); ctx.strokeStyle = `rgba(68,255,68,${0.025 * (1 - d / 85)})`; ctx.lineWidth = 0.4; ctx.stroke(); } }
      id = requestAnimationFrame(draw);
    }
    draw(); return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={canvasRef} style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }} />;
}

function AnimatedCandles() {
  const canvasRef = useRef(null);
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d'); let id, t = 0;
    const W = c.width = 900, H = c.height = 160;
    const cs = Array.from({ length: 45 }, (_, i) => { const base = 60 + Math.sin(i * 0.3) * 20 + Math.random() * 10; const o = base + (Math.random() - 0.5) * 8; const cl = base + (Math.random() - 0.5) * 8; return { x: i * 20, open: o, close: cl, high: Math.max(o, cl) + Math.random() * 6, low: Math.min(o, cl) - Math.random() * 6, phase: Math.random() * Math.PI * 2 }; });
    function draw() {
      ctx.clearRect(0, 0, W, H); ctx.globalAlpha = 0.18;
      for (const c2 of cs) { const d = Math.sin(t * 0.02 + c2.phase) * 4; const o = c2.open + d, cl = c2.close + d, h = c2.high + d, l = c2.low + d; const bull = cl >= o; const col = bull ? '#44FF44' : '#FF4444'; ctx.strokeStyle = col; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(c2.x + 4, H - h); ctx.lineTo(c2.x + 4, H - l); ctx.stroke(); ctx.fillStyle = col; ctx.fillRect(c2.x + 1, H - Math.max(o, cl), 6, Math.abs(cl - o) || 1); }
      t++; id = requestAnimationFrame(draw);
    }
    draw(); return () => cancelAnimationFrame(id);
  }, []);
  return <canvas ref={canvasRef} style={{ width: '100%', height: 160, opacity: 0.45, position: 'absolute', bottom: 0, left: 0 }} />;
}

function PairTicker() {
  const pairs = ['EURUSD', 'GBPUSD', 'USDJPY', 'USDCHF', 'AUDUSD', 'USDCAD', 'NZDUSD'];
  const [data, setData] = useState(() => pairs.map(p => ({ pair: p, price: (1 + Math.random()).toFixed(5), change: ((Math.random() - 0.5) * 0.3).toFixed(2) })));
  useEffect(() => { const iv = setInterval(() => { setData(prev => prev.map(d => { const delta = (Math.random() - 0.5) * 0.002; return { ...d, price: (parseFloat(d.price) + delta).toFixed(5), change: (parseFloat(d.change) + delta * 10).toFixed(2) }; })); }, 2000); return () => clearInterval(iv); }, []);
  return (
    <Box sx={{ display: 'flex', gap: 1.2, justifyContent: 'center', flexWrap: 'wrap', py: 1.5 }}>
      {data.map(d => (
        <Box key={d.pair} sx={{ display: 'flex', alignItems: 'center', gap: 0.7, bgcolor: 'rgba(20,20,20,0.85)', border: '1px solid rgba(68,255,68,0.15)', borderRadius: 1, px: 1, py: 0.35 }}>
          <Typography sx={{ color: '#666', fontSize: 9, fontFamily: 'monospace' }}>{d.pair}</Typography>
          <Typography sx={{ color: '#e0e0e0', fontSize: 10, fontFamily: 'monospace', fontWeight: 'bold' }}>{d.price}</Typography>
          <Typography sx={{ color: parseFloat(d.change) >= 0 ? '#44FF44' : '#FF4444', fontSize: 9, fontFamily: 'monospace' }}>{parseFloat(d.change) >= 0 ? '+' : ''}{d.change}%</Typography>
        </Box>
      ))}
    </Box>
  );
}

export default function LoginPage({ onToggle }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState('landing');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!termsAccepted) { setError('Voce deve aceitar os Termos de Uso e o Consentimento de Risco para continuar.'); return; }
    setError(''); setLoading(true);
    try { await login(email, password); } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const goToLanding = () => { setView('landing'); setError(''); };
  const scrollToTerms = () => { goToLanding(); setTimeout(() => document.getElementById('terms-section')?.scrollIntoView({ behavior: 'smooth' }), 150); };
  const scrollToFeatures = () => { goToLanding(); setTimeout(() => document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' }), 150); };
  const goBackToLogin = () => { setView('login'); setError(''); };
  const scrollUp = () => { document.querySelector('.landing-scroll')?.scrollTo({ top: 0, behavior: 'smooth' }); };

  return (
    <Box sx={{ height: '100vh', bgcolor: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity:0; transform:translateY(30px); } to { opacity:1; transform:translateY(0); } }
        @keyframes glowPulse { 0%,100% { box-shadow:0 0 20px rgba(68,255,68,0.1); } 50% { box-shadow:0 0 40px rgba(68,255,68,0.2); } }
        @keyframes holoShimmer { 0% { background-position:-200% 0; } 100% { background-position:200% 0; } }
        @keyframes borderGlow { 0%,100% { border-color:rgba(68,255,68,0.2); } 50% { border-color:rgba(68,255,68,0.5); } }
        .fade-up { animation: fadeSlideUp 0.6s ease-out both; }
        .fade-up-d1 { animation: fadeSlideUp 0.6s ease-out 0.1s both; }
        .fade-up-d2 { animation: fadeSlideUp 0.6s ease-out 0.2s both; }
        .fade-up-d3 { animation: fadeSlideUp 0.6s ease-out 0.3s both; }
        .glow-card { animation: glowPulse 4s ease-in-out infinite; }
        .holo-border { animation: borderGlow 3s ease-in-out infinite; }
        .shimmer-text { background: linear-gradient(90deg, #44FF44 0%, #88FFAA 40%, #44FF44 80%); background-size: 200% 100%; -webkit-background-clip: text; -webkit-text-fill-color: transparent; animation: holoShimmer 4s linear infinite; }
        .landing-scroll::-webkit-scrollbar { width: 5px; }
        .landing-scroll::-webkit-scrollbar-track { background: #0a0a0a; }
        .landing-scroll::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        .landing-scroll::-webkit-scrollbar-thumb:hover { background: #44FF44; }
        .terms-scroll::-webkit-scrollbar { width: 4px; }
        .terms-scroll::-webkit-scrollbar-track { background: #111; }
        .terms-scroll::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }
        .terms-scroll::-webkit-scrollbar-thumb:hover { background: #44FF44; }
      `}</style>
      <ParticleField />

      <Box sx={{ position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <Box component="nav" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 2, md: 6 }, py: 1.5, borderBottom: '1px solid rgba(68,255,68,0.08)', backdropFilter: 'blur(10px)', bgcolor: 'rgba(10,10,10,0.9)', position: 'sticky', top: 0, zIndex: 100, flexShrink: 0 }}>
          <Box sx={{ cursor: 'pointer' }} onClick={goToLanding}><UkuloLogo /></Box>
          <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
            {view === 'landing' && (<>
              <Button size="small" onClick={scrollToFeatures} sx={{ color: '#888', fontSize: 11, textTransform: 'none', '&:hover': { color: '#44FF44' } }}>Funcionalidades</Button>
              <Button size="small" onClick={scrollToTerms} sx={{ color: '#888', fontSize: 11, textTransform: 'none', '&:hover': { color: '#44FF44' } }}>Termos</Button>
            </>)}
            <Button variant="outlined" size="small" onClick={view === 'login' ? goToLanding : goBackToLogin}
              sx={{ borderColor: '#44FF44', color: '#44FF44', fontSize: 11, textTransform: 'none', px: 2, '&:hover': { borderColor: '#44FF44', bgcolor: 'rgba(68,255,68,0.08)' } }}>
              {view === 'login' ? 'Voltar' : 'Entrar'}
            </Button>
          </Box>
        </Box>

        {view === 'landing' && (
          <Box className="landing-scroll" sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
            <Box sx={{ position: 'relative', minHeight: '92vh', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', px: { xs: 1, md: 4 } }}>
              <HoloScanLine />
              <AnimatedCandles />

              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', maxWidth: 1200, gap: 0, position: 'relative', zIndex: 2 }}>
                <Box sx={{ flex: '0 0 380px', display: { xs: 'none', md: 'flex' }, justifyContent: 'center', alignItems: 'center' }} className="fade-up">
                  <AIBotCanvas />
                </Box>

                <Box sx={{ flex: 1, textAlign: 'center', py: 4, px: 2, maxWidth: 500 }}>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, bgcolor: 'rgba(68,255,68,0.06)', border: '1px solid rgba(68,255,68,0.2)', borderRadius: 2, px: 2, py: 0.5, mb: 3 }} className="fade-up holo-border">
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#44FF44', boxShadow: '0 0 8px #44FF44', animation: 'glowPulse 2s infinite' }} />
                    <Typography sx={{ color: '#44FF44', fontSize: 10, letterSpacing: 2, fontFamily: 'monospace' }}>SISTEMA ATIVO</Typography>
                  </Box>
                  <Typography variant="h1" sx={{ color: '#fff', fontWeight: 'bold', fontSize: { xs: 24, md: 40 }, lineHeight: 1.15, mb: 2 }} className="fade-up-d1">
                    Trade com{' '}<Box component="span" className="shimmer-text" sx={{ fontWeight: 'bold' }}>IA Avancada</Box>{' '}no MetaTrader 5
                  </Typography>
                  <Typography sx={{ color: '#666', fontSize: { xs: 12, md: 14 }, mb: 4, lineHeight: 1.7 }} className="fade-up-d2">
                    Analise com LLM, estrategias ICT/SMC, auto-trading 24/7 e gerenciamento de risco inteligente nos 7 principais pares de forex.
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mb: 3, flexWrap: 'wrap' }} className="fade-up-d3">
                    <Button variant="contained" size="large" onClick={goBackToLogin}
                      sx={{ bgcolor: '#44FF44', color: '#000', fontWeight: 'bold', px: 4, py: 1.1, fontSize: 13, borderRadius: 2, textTransform: 'none', boxShadow: '0 0 30px rgba(68,255,68,0.2)', '&:hover': { bgcolor: '#33cc33' } }}>
                      Comecar Agora
                    </Button>
                    <Button variant="outlined" size="large" onClick={scrollToFeatures}
                      sx={{ borderColor: '#333', color: '#888', px: 4, py: 1.1, fontSize: 13, borderRadius: 2, textTransform: 'none', '&:hover': { borderColor: '#44FF44', color: '#44FF44' } }}>
                      Saiba Mais
                    </Button>
                  </Box>
                  <PairTicker />
                </Box>

                <Box sx={{ flex: '0 0 380px', display: { xs: 'none', md: 'flex' }, justifyContent: 'center', alignItems: 'center' }} className="fade-up">
                  <LLMNeuralCanvas />
                </Box>
              </Box>
            </Box>

            <Box id="features-section" sx={{ px: { xs: 2, md: 6 }, py: 8, maxWidth: 1100, mx: 'auto' }}>
              <Box sx={{ textAlign: 'center', mb: 5 }}>
                <Typography sx={{ color: '#44FF44', fontSize: 11, letterSpacing: 3, mb: 1, fontFamily: 'monospace' }}>FUNCIONALIDADES</Typography>
                <Typography variant="h4" sx={{ color: '#fff', fontWeight: 'bold', mb: 1, fontSize: { xs: 22, md: 28 } }}>
                  Tudo que voce precisa para <Box component="span" className="shimmer-text">operar</Box>
                </Typography>
                <Typography sx={{ color: '#555', fontSize: 13, maxWidth: 480, mx: 'auto' }}>Plataforma completa de trading automatizado com inteligencia artificial</Typography>
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)' }, gap: 2 }}>
                {FEATURES.map((f, i) => (
                  <Paper key={i} className="glow-card" sx={{ p: 3, bgcolor: 'rgba(15,15,15,0.9)', border: '1px solid rgba(68,255,68,0.1)', borderRadius: 2, transition: 'all 0.4s', '&:hover': { borderColor: '#44FF44', transform: 'translateY(-4px)', boxShadow: '0 12px 40px rgba(68,255,68,0.1)' } }}>
                    <Typography sx={{ fontSize: 28, mb: 1.5 }}>{f.icon}</Typography>
                    <Typography sx={{ color: '#e0e0e0', fontWeight: 'bold', mb: 0.5, fontSize: 14 }}>{f.title}</Typography>
                    <Typography sx={{ color: '#555', fontSize: 12, lineHeight: 1.6 }}>{f.desc}</Typography>
                  </Paper>
                ))}
              </Box>
              <Box sx={{ textAlign: 'center', mt: 6 }}>
                <Button variant="outlined" onClick={scrollUp} sx={{ borderColor: '#333', color: '#888', fontSize: 12, textTransform: 'none', borderRadius: 2, '&:hover': { borderColor: '#44FF44', color: '#44FF44' } }}>Voltar ao topo</Button>
              </Box>
            </Box>

            <Box id="terms-section" sx={{ px: { xs: 2, md: 6 }, py: 6, maxWidth: 900, mx: 'auto', borderTop: '1px solid rgba(68,255,68,0.08)' }}>
              <Box sx={{ textAlign: 'center', mb: 4, position: 'sticky', top: 52, zIndex: 10, bgcolor: 'rgba(10,10,10,0.95)', py: 2, backdropFilter: 'blur(8px)' }}>
                <Button size="small" onClick={scrollUp} sx={{ color: '#888', fontSize: 11, textTransform: 'none', mb: 1, '&:hover': { color: '#44FF44' } }}>← Voltar ao topo</Button>
                <Typography sx={{ color: '#44FF44', fontSize: 11, letterSpacing: 3, mb: 1, fontFamily: 'monospace' }}>DOCUMENTOS LEGAIS</Typography>
                <Typography variant="h5" sx={{ color: '#fff', fontWeight: 'bold', fontSize: { xs: 20, md: 24 } }}>Termos & Consentimento</Typography>
              </Box>
              <Box className="terms-scroll" sx={{ maxHeight: { xs: '50vh', md: '55vh' }, overflowY: 'auto', pr: 1 }}>
                <Paper sx={{ p: { xs: 2, md: 4 }, bgcolor: 'rgba(15,15,15,0.9)', border: '1px solid rgba(68,255,68,0.15)', borderRadius: 2, mb: 3 }}>
                  <Typography variant="h6" sx={{ color: '#44FF44', fontSize: 15, mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: 'rgba(68,255,68,0.1)', border: '1px solid rgba(68,255,68,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>1</Box>
                    Termos de Uso
                  </Typography>
                  <Typography sx={{ color: '#777', fontSize: 12, lineHeight: 1.8, mb: 2 }}>Ao acessar e utilizar a plataforma UkuloTrade, voce concorda com os seguintes termos:</Typography>
                  <Box component="ul" sx={{ color: '#777', fontSize: 12, lineHeight: 2.2, pl: 3 }}>
                    <Box component="li">A plataforma e destinada exclusivamente para fins educacionais e de operacoes financeiras.</Box>
                    <Box component="li">Voce e responsavel por todas as decisoes de trading tomadas atraves da plataforma.</Box>
                    <Box component="li">As analises geradas por IA sao sugestoes, nao garantias de lucro.</Box>
                    <Box component="li">A UkuloTrade nao se responsabiliza por perdas financeiras decorrentes do uso da plataforma.</Box>
                    <Box component="li">O usuario deve possuir conhecimento previo sobre operacoes no mercado forex antes de utilizar o auto-trading.</Box>
                    <Box component="li">E proibido o uso da plataforma para lavagem de dinheiro ou actividades ilegais.</Box>
                    <Box component="li">A UkuloTrade reserva-se o direito de suspender contas que violem estes termos.</Box>
                  </Box>
                </Paper>
                <Divider sx={{ borderColor: 'rgba(68,255,68,0.1)', my: 2 }} />
                <Paper sx={{ p: { xs: 2, md: 4 }, bgcolor: 'rgba(15,15,15,0.9)', border: '1px solid rgba(255,170,0,0.2)', borderRadius: 2, mb: 3 }}>
                  <Typography variant="h6" sx={{ color: '#FFAA00', fontSize: 15, mb: 2, fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 24, height: 24, borderRadius: 1, bgcolor: 'rgba(255,170,0,0.1)', border: '1px solid rgba(255,170,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12 }}>2</Box>
                    Consentimento de Risco de Mercado
                  </Typography>
                  <Typography sx={{ color: '#777', fontSize: 12, lineHeight: 1.8, mb: 2 }}><strong style={{ color: '#FF4444' }}>AVISO IMPORTANTE:</strong> O trading de forex e instrumentos financeiros envolve riscos significativos.</Typography>
                  <Box component="ul" sx={{ color: '#777', fontSize: 12, lineHeight: 2.2, pl: 3 }}>
                    <Box component="li"><strong style={{ color: '#aaa' }}>Risco de Perda:</strong> Voce pode perder todo o capital investido.</Box>
                    <Box component="li"><strong style={{ color: '#aaa' }}>Alavancagem:</strong> Operacoes com alavancagem podem amplificar tanto lucros quanto perdas.</Box>
                    <Box component="li"><strong style={{ color: '#aaa' }}>Volatilidade:</strong> O mercado forex e altamente volatil e pode sofrer movimentos bruscos.</Box>
                    <Box component="li"><strong style={{ color: '#aaa' }}>Auto-Trading:</strong> O sistema automatizado pode gerar perdas. O monitoramento constante e recomendado.</Box>
                    <Box component="li"><strong style={{ color: '#aaa' }}>Analise por IA:</strong> Modelos de linguagem podem cometer erros. As recomendacoes nao garantem resultados.</Box>
                    <Box component="li"><strong style={{ color: '#aaa' }}>Dados de Mercado:</strong> Atrasos ou imprecisoes nos dados podem afetar as decisoes de trading.</Box>
                  </Box>
                  <Typography sx={{ color: '#555', fontSize: 11, lineHeight: 1.7, fontStyle: 'italic', borderLeft: '2px solid #FFAA00', pl: 2, mt: 2 }}>
                    Ao utilizar esta plataforma, voce declara ter pleno conhecimento dos riscos envolvidos nas operacoes de forex e aceita integralmente a responsabilidade por seus investimentos. A UkuloTrade e seus desenvolvedores isentam-se de qualquer responsabilidade por perdas financeiras.
                  </Typography>
                </Paper>
              </Box>
              <Box sx={{ textAlign: 'center', mt: 4, display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
                <Button variant="outlined" onClick={scrollUp} sx={{ borderColor: '#333', color: '#888', fontSize: 12, textTransform: 'none', borderRadius: 2, '&:hover': { borderColor: '#44FF44', color: '#44FF44' } }}>← Voltar ao topo</Button>
                <Button variant="contained" onClick={goBackToLogin} sx={{ bgcolor: '#44FF44', color: '#000', fontWeight: 'bold', fontSize: 12, textTransform: 'none', borderRadius: 2, px: 4, boxShadow: '0 0 20px rgba(68,255,68,0.15)', '&:hover': { bgcolor: '#33cc33' } }}>Aceitar e Entrar →</Button>
              </Box>
            </Box>
            <Box sx={{ px: { xs: 2, md: 6 }, py: 3, borderTop: '1px solid rgba(68,255,68,0.05)', textAlign: 'center' }}>
              <Typography sx={{ color: '#333', fontSize: 10, letterSpacing: 1 }}>&copy; 2026 UkuloTrade. Todos os direitos reservados.</Typography>
            </Box>
          </Box>
        )}

        {view === 'login' && (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 2, position: 'relative', overflow: 'hidden' }}>
            <HoloScanLine />
            <Paper sx={{ p: 4, width: '100%', maxWidth: 400, bgcolor: 'rgba(15,15,15,0.95)', border: '1px solid rgba(68,255,68,0.15)', backdropFilter: 'blur(12px)', borderRadius: 3, position: 'relative', zIndex: 1, boxShadow: '0 0 60px rgba(68,255,68,0.05)' }} className="fade-up glow-card">
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 1 }}><UkuloLogo size="large" /></Box>
              <Typography sx={{ color: '#555', mb: 3, textAlign: 'center', fontSize: 11, letterSpacing: 1 }}>ACESSE SUA PLATAFORMA</Typography>
              {error && <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(255,68,68,0.08)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.2)', fontSize: 12 }}>{error}</Alert>}
              <form onSubmit={handleSubmit}>
                <TextField fullWidth label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required size="small"
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#222' }, '&:hover fieldset': { borderColor: 'rgba(68,255,68,0.5)' }, '&.Mui-focused fieldset': { borderColor: '#44FF44' } }, '& .MuiInputLabel-root': { color: '#555' }, '& .MuiInputLabel-root.Mui-focused': { color: '#44FF44' } }} />
                <TextField fullWidth label="Senha" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required size="small"
                  InputProps={{ endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} sx={{ color: showPassword ? '#44FF44' : '#555', p: 0.5 }}>
                        <span style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</span>
                      </IconButton>
                    </InputAdornment>
                  )}}
                  sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#222' }, '&:hover fieldset': { borderColor: 'rgba(68,255,68,0.5)' }, '&.Mui-focused fieldset': { borderColor: '#44FF44' } }, '& .MuiInputLabel-root': { color: '#555' }, '& .MuiInputLabel-root.Mui-focused': { color: '#44FF44' } }} />
                <FormControlLabel control={<Checkbox checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} sx={{ color: '#555', '&.Mui-checked': { color: '#44FF44' } }} />}
                  label={<Typography sx={{ color: '#666', fontSize: 11, lineHeight: 1.4 }}>
                    Li e aceito os <Link component="button" type="button" onClick={e => { e.preventDefault(); scrollToTerms(); }} sx={{ color: '#44FF44', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>Termos de Uso</Link>
                    {' '}e o <Link component="button" type="button" onClick={e => { e.preventDefault(); scrollToTerms(); }} sx={{ color: '#FFAA00', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}>Consentimento de Risco</Link>
                  </Typography>} sx={{ mb: 2, alignItems: 'flex-start' }} />
                <Button fullWidth variant="contained" type="submit" disabled={loading}
                  sx={{ bgcolor: '#44FF44', color: '#000', fontWeight: 'bold', py: 1, fontSize: 14, borderRadius: 2, textTransform: 'none', boxShadow: '0 0 20px rgba(68,255,68,0.15)', '&:hover': { bgcolor: '#33cc33' }, '&:disabled': { bgcolor: '#333', color: '#555' } }}>
                  {loading ? <CircularProgress size={22} color="inherit" /> : 'Entrar'}
                </Button>
              </form>
              <Typography sx={{ mt: 2.5, textAlign: 'center', color: '#555', fontSize: 12 }}>
                Nao tem conta?{' '}<Link component="button" variant="body2" onClick={onToggle} sx={{ color: '#44FF44', textDecoration: 'none', fontSize: 12, '&:hover': { textDecoration: 'underline' } }}>Criar conta gratuita</Link>
              </Typography>
            </Paper>
          </Box>
        )}
      </Box>
    </Box>
  );
}
