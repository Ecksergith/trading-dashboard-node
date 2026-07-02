import { useRef, useEffect } from 'react';
import { Box, Paper, Typography, Chip } from '@mui/material';
import { useApp } from '../../context/AppContext';

export default function LogsTab() {
  const { logs } = useApp();
  const logRef = useRef(null);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [logs]);

  const levelColor = (level) => {
    switch (level) {
      case 'error': return '#FF4444';
      case 'warning': return '#FFAA00';
      case 'info': return '#44FF44';
      case 'debug': return '#888';
      default: return '#aaa';
    }
  };

  const levelBg = (level) => {
    switch (level) {
      case 'error': return 'rgba(255,68,68,0.1)';
      case 'warning': return 'rgba(255,170,0,0.1)';
      case 'info': return 'rgba(68,255,68,0.05)';
      default: return 'transparent';
    }
  };

  return (
    <Paper sx={{ p: 1, bgcolor: '#1a1a1a', height: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
        <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', flex: 1 }}>
          Logs do Sistema ({logs.length} entradas)
        </Typography>
        <Chip size="small" label={`${logs.filter(l => l.level === 'error').length} erros`}
          sx={{ bgcolor: '#2a2a2a', color: '#FF4444', fontSize: 10, mr: 0.5 }} />
        <Chip size="small" label={`${logs.filter(l => l.level === 'warning').length} warnings`}
          sx={{ bgcolor: '#2a2a2a', color: '#FFAA00', fontSize: 10 }} />
      </Box>

      <Box ref={logRef} sx={{
        height: 'calc(100% - 30px)', overflow: 'auto', bgcolor: '#0d0d0d', borderRadius: 1, p: 0.5,
        fontFamily: '"Consolas", "Courier New", monospace',
      }}>
        {logs.length === 0 && (
          <Typography sx={{ color: '#555', fontSize: 11, textAlign: 'center', mt: 4 }}>
            Nenhum log registrado. O sistema comecara a registrar atividade em breve.
          </Typography>
        )}
        {logs.map((entry, i) => (
          <Box key={i} sx={{
            display: 'flex', py: 0.15, px: 0.5, mb: 0.1, borderRadius: 0.5,
            bgcolor: levelBg(entry.level), '&:hover': { bgcolor: 'rgba(255,255,255,0.03)' },
          }}>
            <Typography sx={{ color: '#555', fontSize: 10, mr: 1, whiteSpace: 'nowrap', minWidth: 75 }}>
              {entry.time ? new Date(entry.time).toLocaleTimeString() : '--:--:--'}
            </Typography>
            <Chip size="small" label={entry.level?.toUpperCase() || 'LOG'}
              sx={{
                bgcolor: 'transparent', color: levelColor(entry.level),
                fontSize: 9, height: 16, mr: 1, minWidth: 45,
                '& .MuiChip-label': { px: 0.5 },
              }} />
            <Typography sx={{ color: levelColor(entry.level), fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {entry.message}
            </Typography>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}
