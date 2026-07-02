import { useState, useEffect, useMemo } from 'react';
import { Box, Grid, Paper, Typography, Select, MenuItem, FormControl, InputLabel, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, Divider, LinearProgress } from '@mui/material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, Legend } from 'recharts';
import { useApp } from '../../context/AppContext';

const COLORS = ['#44FF44', '#FF4444', '#FFAA00', '#4a9eff'];

function MetricCard({ label, value, color = '#e0e0e0', sub }) {
  return (
    <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
      <Typography sx={{ color: '#888', fontSize: 10 }}>{label}</Typography>
      <Typography sx={{ color, fontSize: 20, fontWeight: 'bold' }}>{value}</Typography>
      {sub && <Typography sx={{ color: '#666', fontSize: 9 }}>{sub}</Typography>}
    </Paper>
  );
}

function EquityCurveChart({ data }) {
  if (!data || data.length === 0) {
    return <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#666', fontSize: 12 }}>Sem dados de equity</Box>;
  }
  const chartData = data.map((d, i) => ({
    idx: i,
    time: new Date(d.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    equity: d.equity,
    pnl: d.pnl,
  }));
  const minVal = Math.min(...chartData.map(d => d.equity));
  const maxVal = Math.max(...chartData.map(d => d.equity));
  const pad = (maxVal - minVal) * 0.1 || 100;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="eqGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#44FF44" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#44FF44" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="time" tick={{ fill: '#888', fontSize: 9 }} interval="preserveStartEnd" />
        <YAxis domain={[minVal - pad, maxVal + pad]} tick={{ fill: '#888', fontSize: 9 }} tickFormatter={v => `$${v.toFixed(0)}`} />
        <Tooltip contentStyle={{ bgcolor: '#2a2a2a', border: '1px solid #444', fontSize: 11 }}
          formatter={(v, n) => [`$${v.toFixed(2)}`, n === 'equity' ? 'Equity' : 'P/L']} />
        <Area type="monotone" dataKey="equity" stroke="#44FF44" strokeWidth={2} fill="url(#eqGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DailyPnlChart({ data }) {
  if (!data || data.length === 0) return null;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data.slice(-30)} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="date" tick={{ fill: '#888', fontSize: 8 }} interval={Math.max(0, Math.floor(data.length / 10))} />
        <YAxis tick={{ fill: '#888', fontSize: 9 }} tickFormatter={v => `$${v}`} />
        <Tooltip contentStyle={{ bgcolor: '#2a2a2a', border: '1px solid #444', fontSize: 11 }}
          formatter={v => [`$${v.toFixed(2)}`, 'P/L']} />
        <Bar dataKey="pnl" radius={[2, 2, 0, 0]}>
          {data.slice(-30).map((d, i) => (
            <Cell key={i} fill={d.pnl >= 0 ? '#44FF44' : '#FF4444'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function PairStatsTable({ data }) {
  if (!data || data.length === 0) return <Typography sx={{ color: '#666', fontSize: 11, textAlign: 'center', mt: 2 }}>Sem dados</Typography>;
  return (
    <TableContainer sx={{ maxHeight: 250 }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Par</TableCell>
            <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Trades</TableCell>
            <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Wins</TableCell>
            <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Win Rate</TableCell>
            <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>P/L</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map(p => (
            <TableRow key={p.pair}>
              <TableCell sx={{ fontSize: 11, fontWeight: 'bold' }}>{p.pair}</TableCell>
              <TableCell sx={{ fontSize: 11 }}>{p.trades}</TableCell>
              <TableCell sx={{ fontSize: 11, color: '#44FF44' }}>{p.wins}</TableCell>
              <TableCell sx={{ fontSize: 11 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LinearProgress variant="determinate" value={p.winRate}
                    sx={{ flex: 1, height: 4, borderRadius: 2, bgcolor: '#333', '& .MuiLinearProgress-bar': { bgcolor: p.winRate >= 50 ? '#44FF44' : '#FF4444', borderRadius: 2 } }} />
                  <Typography sx={{ color: p.winRate >= 50 ? '#44FF44' : '#FF4444', fontSize: 10, minWidth: 35 }}>{p.winRate}%</Typography>
                </Box>
              </TableCell>
              <TableCell sx={{ fontSize: 11, color: p.pnl >= 0 ? '#44FF44' : '#FF4444' }}>${p.pnl.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default function AccountPerformanceTab() {
  const { accounts, apiGet } = useApp();
  const [selectedAccount, setSelectedAccount] = useState('');
  const [perf, setPerf] = useState(null);
  const [allPerf, setAllPerf] = useState([]);

  useEffect(() => {
    if (accounts?.length && !selectedAccount) {
      setSelectedAccount(accounts[0].id);
    }
  }, [accounts]);

  useEffect(() => {
    const fetchAll = async () => {
      const data = await apiGet('/api/accounts/performance/all');
      if (data) setAllPerf(data);
    };
    fetchAll();
    const t = setInterval(fetchAll, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    const fetchPerf = async () => {
      const data = await apiGet(`/api/accounts/${selectedAccount}/performance`);
      if (data) setPerf(data);
    };
    fetchPerf();
    const t = setInterval(fetchPerf, 10000);
    return () => clearInterval(t);
  }, [selectedAccount]);

  const s = perf?.summary || {};
  const winPie = s.totalTrades > 0 ? [
    { name: 'Wins', value: s.winTrades || 0 },
    { name: 'Losses', value: s.loseTrades || 0 },
    { name: 'Breakeven', value: s.breakevenTrades || 0 },
  ] : [];

  const directionPie = (s.buyTrades > 0 || s.sellTrades > 0) ? [
    { name: 'Compras', value: s.buyTrades || 0 },
    { name: 'Vendas', value: s.sellTrades || 0 },
  ] : [];

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {/* Account Selector + All Accounts Overview */}
      <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel sx={{ color: '#888' }}>Conta</InputLabel>
          <Select value={selectedAccount} label="Conta" onChange={e => setSelectedAccount(e.target.value)}
            sx={{ color: '#e0e0e0', fontSize: 12 }}>
            {accounts?.map(a => (
              <MenuItem key={a.id} value={a.id} sx={{ fontSize: 12 }}>
                {a.name} {a.connected ? '(ON)' : '(OFF)'}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Divider orientation="vertical" flexItem sx={{ bgcolor: '#333' }} />

        {allPerf.map(ap => (
          <Box key={ap.accountId} onClick={() => setSelectedAccount(ap.accountId)}
            sx={{
              cursor: 'pointer', bgcolor: ap.accountId === selectedAccount ? 'rgba(68,255,68,0.1)' : '#2a2a2a',
              border: `1px solid ${ap.accountId === selectedAccount ? '#44FF44' : '#333'}`,
              borderRadius: 1, px: 1, py: 0.5,
              transition: 'all 0.2s',
              '&:hover': { borderColor: '#44FF44' },
            }}>
            <Typography sx={{ color: ap.accountId === selectedAccount ? '#44FF44' : '#e0e0e0', fontSize: 11, fontWeight: 'bold' }}>{ap.accountName}</Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Typography sx={{ color: '#888', fontSize: 9 }}>WR: {ap.winRate}%</Typography>
              <Typography sx={{ color: ap.totalProfit >= 0 ? '#44FF44' : '#FF4444', fontSize: 9 }}>${ap.totalProfit.toFixed(2)}</Typography>
            </Box>
          </Box>
        ))}
      </Paper>

      {!perf ? (
        <Paper sx={{ p: 3, bgcolor: '#1a1a1a', textAlign: 'center' }}>
          <Typography sx={{ color: '#666', fontSize: 12 }}>Selecione uma conta para ver o relatorio</Typography>
        </Paper>
      ) : (
        <>
          {/* Main Metrics */}
          <Grid container spacing={1}>
            <Grid item xs={6} md={2}><MetricCard label="Total Trades" value={s.totalTrades} color="#e0e0e0" /></Grid>
            <Grid item xs={6} md={2}><MetricCard label="Win Rate" value={`${s.winRate}%`} color="#FFAA00" sub={`${s.winTrades}W / ${s.loseTrades}L`} /></Grid>
            <Grid item xs={6} md={2}><MetricCard label="Lucro Total" value={`$${s.totalProfit?.toFixed(2)}`} color={s.totalProfit >= 0 ? '#44FF44' : '#FF4444'} /></Grid>
            <Grid item xs={6} md={2}><MetricCard label="Profit Factor" value={s.profitFactor} color={s.profitFactor >= 1 ? '#44FF44' : '#FF4444'} /></Grid>
            <Grid item xs={6} md={2}><MetricCard label="Expectancy" value={`$${s.expectancy?.toFixed(2)}`} color={s.expectancy >= 0 ? '#44FF44' : '#FF4444'} /></Grid>
            <Grid item xs={6} md={2}><MetricCard label="Max Drawdown" value={`$${s.maxDrawdown?.toFixed(2)}`} color="#FF4444" /></Grid>
          </Grid>

          <Grid container spacing={1}>
            <Grid item xs={6} md={3}><MetricCard label="Avg Win" value={`$${s.avgWin?.toFixed(2)}`} color="#44FF44" /></Grid>
            <Grid item xs={6} md={3}><MetricCard label="Avg Loss" value={`$${s.avgLoss?.toFixed(2)}`} color="#FF4444" /></Grid>
            <Grid item xs={6} md={3}><MetricCard label="Buy Win Rate" value={`${s.buyWinRate}%`} color="#44FF44" sub={`${s.buyTrades} trades`} /></Grid>
            <Grid item xs={6} md={3}><MetricCard label="Sell Win Rate" value={`${s.sellWinRate}%`} color="#FF4444" sub={`${s.sellTrades} trades`} /></Grid>
          </Grid>

          {/* Best / Worst Trade */}
          <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', display: 'flex', gap: 2 }}>
            {s.bestTrade && (
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: '#44FF44', fontSize: 11, fontWeight: 'bold' }}>Melhor Trade</Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: 12 }}>{s.bestTrade.symbol} - ${s.bestTrade.profit?.toFixed(2)}</Typography>
                <Typography sx={{ color: '#888', fontSize: 10 }}>{s.bestTrade.time ? new Date(s.bestTrade.time).toLocaleString('pt-BR') : '-'}</Typography>
              </Box>
            )}
            {s.worstTrade && (
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: '#FF4444', fontSize: 11, fontWeight: 'bold' }}>Pior Trade</Typography>
                <Typography sx={{ color: '#e0e0e0', fontSize: 12 }}>{s.worstTrade.symbol} - ${s.worstTrade.profit?.toFixed(2)}</Typography>
                <Typography sx={{ color: '#888', fontSize: 10 }}>{s.worstTrade.time ? new Date(s.worstTrade.time).toLocaleString('pt-BR') : '-'}</Typography>
              </Box>
            )}
          </Paper>

          {/* Equity Curve */}
          <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
            <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Curva de Equity</Typography>
            <EquityCurveChart data={perf.equityCurve} />
          </Paper>

          {/* Daily PnL + Distribution */}
          <Grid container spacing={1}>
            <Grid item xs={12} md={8}>
              <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
                <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>P/L Diario</Typography>
                <DailyPnlChart data={perf.dailyPnl} />
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', height: 210 }}>
                <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Distribuicao</Typography>
                {winPie.length > 0 ? (
                  <ResponsiveContainer width="100%" height="80%">
                    <PieChart>
                      <Pie data={winPie} dataKey="value" cx="50%" cy="50%" outerRadius={65}
                        label={({ name, value }) => `${name}: ${value}`}>
                        {winPie.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ bgcolor: '#2a2a2a', border: '1px solid #444', fontSize: 11 }} />
                      <Legend wrapperStyle={{ fontSize: 10, color: '#888' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80%', color: '#666', fontSize: 11 }}>Sem dados</Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Pair Stats + Monthly PnL */}
          <Grid container spacing={1}>
            <Grid item xs={12} md={7}>
              <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
                <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Performance por Par</Typography>
                <PairStatsTable data={perf.pairStats} />
              </Paper>
            </Grid>
            <Grid item xs={12} md={5}>
              <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
                <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>P/L Mensal</Typography>
                {perf.monthlyPnl?.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={perf.monthlyPnl} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="month" tick={{ fill: '#888', fontSize: 10 }} />
                      <YAxis tick={{ fill: '#888', fontSize: 10 }} tickFormatter={v => `$${v}`} />
                      <Tooltip contentStyle={{ bgcolor: '#2a2a2a', border: '1px solid #444', fontSize: 11 }}
                        formatter={v => [`$${v.toFixed(2)}`, 'P/L']} />
                      <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                        {perf.monthlyPnl.map((d, i) => (
                          <Cell key={i} fill={d.pnl >= 0 ? '#44FF44' : '#FF4444'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 250, color: '#666', fontSize: 11 }}>Sem dados mensais</Box>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Recent Trades */}
          <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
            <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>
              Ultimos Trades ({perf.recentTrades?.length || 0})
            </Typography>
            <TableContainer sx={{ maxHeight: 300 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>#</TableCell>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Par</TableCell>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Tipo</TableCell>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Volume</TableCell>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Entrada</TableCell>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Saida</TableCell>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>P/L</TableCell>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Fonte</TableCell>
                    <TableCell sx={{ color: '#44FF44', fontSize: 10 }}>Hora</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {perf.recentTrades?.map((t, i) => (
                    <TableRow key={i}>
                      <TableCell sx={{ fontSize: 10 }}>{i + 1}</TableCell>
                      <TableCell sx={{ fontSize: 10, fontWeight: 'bold' }}>{t.symbol || t.pair || '-'}</TableCell>
                      <TableCell sx={{ fontSize: 10, color: (t.type === 'buy' || t.type === 'BUY') ? '#44FF44' : '#FF4444' }}>{t.type}</TableCell>
                      <TableCell sx={{ fontSize: 10 }}>{t.volume}</TableCell>
                      <TableCell sx={{ fontSize: 10 }}>{t.price?.toFixed(5) || '-'}</TableCell>
                      <TableCell sx={{ fontSize: 10 }}>{t.exitPrice?.toFixed(5) || '-'}</TableCell>
                      <TableCell sx={{ fontSize: 10, color: (t.profit || 0) >= 0 ? '#44FF44' : '#FF4444', fontWeight: 'bold' }}>
                        ${(t.profit || 0).toFixed(2)}
                      </TableCell>
                      <TableCell sx={{ fontSize: 10 }}>
                        <Chip size="small" label={t.source || t.signalSource || '-'}
                          sx={{ bgcolor: '#2a2a2a', fontSize: 8, height: 16 }} />
                      </TableCell>
                      <TableCell sx={{ fontSize: 10, color: '#888' }}>
                        {t.time ? new Date(t.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!perf.recentTrades || perf.recentTrades.length === 0) && (
                    <TableRow><TableCell colSpan={9} sx={{ textAlign: 'center', color: '#666', fontSize: 11 }}>Nenhum trade registrado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </>
      )}
    </Box>
  );
}
