import { useState, useEffect, useMemo } from 'react';
import { Box, Grid, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, LinearProgress } from '@mui/material';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area } from 'recharts';
import { useApp } from '../../context/AppContext';

const COLORS = ['#44FF44', '#FF4444', '#FFAA00', '#4a9eff'];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Marco', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];

function EquityCurveChart({ equityHistory }) {
  const chartData = useMemo(() => {
    if (!equityHistory || equityHistory.length === 0) return [];
    return equityHistory.map((e) => ({
      time: new Date(e.time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      equity: e.equity,
      balance: e.balance,
    }));
  }, [equityHistory]);

  if (chartData.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, color: '#666', fontSize: 12 }}>
        Aguardando dados de equity...
      </Box>
    );
  }

  const minVal = Math.min(...chartData.map(d => Math.min(d.equity, d.balance)));
  const maxVal = Math.max(...chartData.map(d => Math.max(d.equity, d.balance)));
  const padding = (maxVal - minVal) * 0.1 || 100;

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#44FF44" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#44FF44" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="balanceGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4a9eff" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#4a9eff" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
        <XAxis dataKey="time" tick={{ fill: '#888', fontSize: 10 }} interval="preserveStartEnd" />
        <YAxis domain={[minVal - padding, maxVal + padding]} tick={{ fill: '#888', fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(0)}`} />
        <Tooltip
          contentStyle={{ bgcolor: '#2a2a2a', border: '1px solid #444', fontSize: 11 }}
          formatter={(value, name) => [`$${value.toFixed(2)}`, name === 'equity' ? 'Equity' : 'Saldo']}
          labelStyle={{ color: '#aaa' }}
        />
        <Area type="monotone" dataKey="balance" stroke="#4a9eff" strokeWidth={1.5} fill="url(#balanceGrad)" />
        <Area type="monotone" dataKey="equity" stroke="#44FF44" strokeWidth={2} fill="url(#equityGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function DailyPnlCalendar({ tradeHistory }) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const dailyPnl = useMemo(() => {
    const map = {};
    for (const t of tradeHistory) {
      if (!t.time) continue;
      const d = new Date(t.time).toISOString().slice(0, 10);
      if (!map[d]) map[d] = 0;
      map[d] += t.profit || 0;
    }
    return map;
  }, [tradeHistory]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  const calendarDays = [];
  for (let i = 0; i < firstDay; i++) calendarDays.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarDays.push(d);

  const monthPnl = useMemo(() => {
    let total = 0;
    let winDays = 0;
    let loseDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      if (dailyPnl[key] !== undefined) {
        total += dailyPnl[key];
        if (dailyPnl[key] > 0) winDays++;
        else if (dailyPnl[key] < 0) loseDays++;
      }
    }
    return { total, winDays, loseDays };
  }, [dailyPnl, year, month, daysInMonth]);

  return (
    <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Box
          component="button"
          onClick={() => setCurrentDate(new Date(year, month - 1))}
          sx={{ bgcolor: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, p: 0.5, '&:hover': { color: '#fff' } }}
        >
          &#8249;
        </Box>
        <Box sx={{ textAlign: 'center' }}>
          <Typography sx={{ color: '#44FF44', fontWeight: 'bold', fontSize: 13 }}>
            {MONTH_NAMES[month]} {year}
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mt: 0.5, justifyContent: 'center' }}>
            <Typography sx={{ fontSize: 10, color: monthPnl.total >= 0 ? '#44FF44' : '#FF4444' }}>
              P/L: ${monthPnl.total.toFixed(2)}
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#44FF44' }}>
              {monthPnl.winDays}W
            </Typography>
            <Typography sx={{ fontSize: 10, color: '#FF4444' }}>
              {monthPnl.loseDays}L
            </Typography>
          </Box>
        </Box>
        <Box
          component="button"
          onClick={() => setCurrentDate(new Date(year, month + 1))}
          sx={{ bgcolor: 'transparent', border: 'none', color: '#888', cursor: 'pointer', fontSize: 18, p: 0.5, '&:hover': { color: '#fff' } }}
        >
          &#8250;
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {DAY_NAMES.map((d) => (
          <Box key={d} sx={{ textAlign: 'center', py: 0.3 }}>
            <Typography sx={{ color: '#666', fontSize: 9, fontWeight: 'bold' }}>{d}</Typography>
          </Box>
        ))}

        {calendarDays.map((day, i) => {
          if (day === null) return <Box key={`empty-${i}`} />;
          const key = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          const pnl = dailyPnl[key];
          const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
          const hasData = pnl !== undefined;

          let bgColor = '#2a2a2a';
          let textColor = '#666';
          let borderColor = 'transparent';

          if (hasData && pnl > 0) { bgColor = '#1a3a1a'; textColor = '#44FF44'; borderColor = '#44FF44'; }
          else if (hasData && pnl < 0) { bgColor = '#3a1a1a'; textColor = '#FF4444'; borderColor = '#FF4444'; }
          else if (hasData && pnl === 0) { bgColor = '#2a2a2a'; textColor = '#888'; borderColor = '#FFAA00'; }

          if (isToday) { borderColor = '#4a9eff'; }

          return (
            <Box
              key={day}
              sx={{
                bgcolor: bgColor,
                border: `1px solid ${borderColor}`,
                borderRadius: 0.5,
                textAlign: 'center',
                py: 0.5,
                minHeight: 38,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Typography sx={{ color: textColor, fontSize: 10, fontWeight: 'bold' }}>{day}</Typography>
              {hasData && (
                <Typography sx={{ color: pnl >= 0 ? '#44FF44' : '#FF4444', fontSize: 8, mt: 0.2 }}>
                  ${pnl.toFixed(0)}
                </Typography>
              )}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}

export default function PerformanceTab() {
  const { accountInfo, positions, tradeHistory, equityHistory, apiGet } = useApp();
  const [performance, setPerformance] = useState({});
  const [trades, setTrades] = useState([]);

  useEffect(() => {
    setTrades(tradeHistory);
  }, [tradeHistory]);

  useEffect(() => {
    const fetchPerf = async () => {
      const perf = await apiGet('/api/performance');
      if (perf) setPerformance(perf);
    };
    fetchPerf();
    const t = setInterval(fetchPerf, 15000);
    return () => clearInterval(t);
  }, []);

  const balance = performance.balance || 0;
  const equity = performance.equity || 0;
  const totalProfit = performance.total_profit || 0;
  const winRate = performance.win_rate || 0;
  const totalTrades = performance.total_trades || 0;
  const winTrades = performance.winning_trades || 0;
  const loseTrades = totalTrades - winTrades;

  const pieData = [
    { name: 'Wins', value: winTrades || 0 },
    { name: 'Losses', value: loseTrades || 0 },
  ];

  const avgProfit = totalTrades > 0 ? totalProfit / totalTrades : 0;
  const profitFactor = loseTrades > 0 && winTrades > 0
    ? (tradeHistory.filter(t => t.profit > 0).reduce((s, t) => s + t.profit, 0) /
       Math.abs(tradeHistory.filter(t => t.profit < 0).reduce((s, t) => s + t.profit, 0)) || 0).toFixed(2)
    : 'N/A';

  return (
    <Grid container spacing={1}>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
          <Typography sx={{ color: '#888', fontSize: 11 }}>Saldo</Typography>
          <Typography sx={{ color: '#44FF44', fontSize: 22, fontWeight: 'bold' }}>${balance.toFixed(2)}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
          <Typography sx={{ color: '#888', fontSize: 11 }}>Equity</Typography>
          <Typography sx={{ color: '#4a9eff', fontSize: 22, fontWeight: 'bold' }}>${equity.toFixed(2)}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
          <Typography sx={{ color: '#888', fontSize: 11 }}>Lucro Total</Typography>
          <Typography sx={{ color: totalProfit >= 0 ? '#44FF44' : '#FF4444', fontSize: 22, fontWeight: 'bold' }}>${totalProfit.toFixed(2)}</Typography>
        </Paper>
      </Grid>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', textAlign: 'center' }}>
          <Typography sx={{ color: '#888', fontSize: 11 }}>Win Rate</Typography>
          <Typography sx={{ color: '#FFAA00', fontSize: 22, fontWeight: 'bold' }}>{winRate.toFixed(1)}%</Typography>
          <LinearProgress variant="determinate" value={winRate} sx={{ mt: 0.5, height: 4, borderRadius: 2, bgcolor: '#333', '& .MuiLinearProgress-bar': { bgcolor: '#FFAA00', borderRadius: 2 } }} />
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>
            Evolucao do Patrimonio
          </Typography>
          <EquityCurveChart equityHistory={equityHistory} />
        </Paper>
      </Grid>

      <Grid item xs={12} md={8}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Historico de Trades</Typography>
          <TableContainer sx={{ maxHeight: 300 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ color: '#44FF44', fontSize: 11 }}>#</TableCell>
                  <TableCell sx={{ color: '#44FF44', fontSize: 11 }}>Par</TableCell>
                  <TableCell sx={{ color: '#44FF44', fontSize: 11 }}>Tipo</TableCell>
                  <TableCell sx={{ color: '#44FF44', fontSize: 11 }}>Entrada</TableCell>
                  <TableCell sx={{ color: '#44FF44', fontSize: 11 }}>Saida</TableCell>
                  <TableCell sx={{ color: '#44FF44', fontSize: 11 }}>P/L</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {trades.slice(-20).reverse().map((t, i) => (
                  <TableRow key={i}>
                    <TableCell sx={{ fontSize: 11 }}>{i + 1}</TableCell>
                    <TableCell sx={{ fontSize: 11 }}>{t.symbol || t.pair || '-'}</TableCell>
                    <TableCell sx={{ fontSize: 11, color: t.type === 'buy' ? '#44FF44' : '#FF4444' }}>{t.type}</TableCell>
                    <TableCell sx={{ fontSize: 11 }}>{t.price?.toFixed(5) || '-'}</TableCell>
                    <TableCell sx={{ fontSize: 11 }}>{t.exitPrice?.toFixed(5) || '-'}</TableCell>
                    <TableCell sx={{ fontSize: 11, color: (t.profit || 0) >= 0 ? '#44FF44' : '#FF4444' }}>${(t.profit || 0).toFixed(2)}</TableCell>
                  </TableRow>
                ))}
                {trades.length === 0 && (
                  <TableRow><TableCell colSpan={6} sx={{ textAlign: 'center', color: '#666', fontSize: 11 }}>Nenhum trade realizado</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>

      <Grid item xs={12} md={4}>
        <DailyPnlCalendar tradeHistory={tradeHistory} />
      </Grid>

      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', height: 340 }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Distribuicao</Typography>
          {totalTrades > 0 ? (
            <ResponsiveContainer width="100%" height="85%">
              <PieChart>
                <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ bgcolor: '#2a2a2a', border: '1px solid #444', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '85%', color: '#666', fontSize: 12 }}>
              Sem dados suficientes
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Estatisticas</Typography>
          <Box sx={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            <Box><Typography sx={{ color: '#888', fontSize: 11 }}>Total Trades</Typography><Typography sx={{ color: '#e0e0e0', fontSize: 14 }}>{totalTrades}</Typography></Box>
            <Box><Typography sx={{ color: '#888', fontSize: 11 }}>Wins</Typography><Typography sx={{ color: '#44FF44', fontSize: 14 }}>{winTrades}</Typography></Box>
            <Box><Typography sx={{ color: '#888', fontSize: 11 }}>Losses</Typography><Typography sx={{ color: '#FF4444', fontSize: 14 }}>{loseTrades}</Typography></Box>
            <Box><Typography sx={{ color: '#888', fontSize: 11 }}>Profit Factor</Typography><Typography sx={{ color: '#FFAA00', fontSize: 14 }}>{profitFactor}</Typography></Box>
            <Box><Typography sx={{ color: '#888', fontSize: 11 }}>Avg Profit</Typography><Typography sx={{ color: avgProfit >= 0 ? '#44FF44' : '#FF4444', fontSize: 14 }}>${avgProfit.toFixed(2)}</Typography></Box>
            <Box><Typography sx={{ color: '#888', fontSize: 11 }}>Posicoes Abertas</Typography><Typography sx={{ color: '#4a9eff', fontSize: 14 }}>{positions.length}</Typography></Box>
          </Box>
        </Paper>
      </Grid>
    </Grid>
  );
}
