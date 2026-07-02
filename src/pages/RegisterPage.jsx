import { useState } from 'react';
import { Box, Paper, TextField, Button, Typography, Alert, Link, CircularProgress, Checkbox, FormControlLabel, IconButton, InputAdornment } from '@mui/material';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage({ onToggle }) {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!termsAccepted) { setError('Voce deve aceitar os Termos de Uso e o Consentimento de Risco para continuar.'); return; }
    setError('');
    setLoading(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
      <style>{`
        @keyframes fadeSlideUp { from { opacity: 0; transform: translateY(30px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes glowPulse { 0%, 100% { box-shadow: 0 0 20px rgba(68,255,68,0.1); } 50% { box-shadow: 0 0 40px rgba(68,255,68,0.2); } }
        @keyframes holoShimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
        @keyframes borderGlow { 0%, 100% { border-color: rgba(68,255,68,0.2); } 50% { border-color: rgba(68,255,68,0.5); } }
        @keyframes scanLine { 0% { top: 0; } 100% { top: 100%; } }
        .fade-up { animation: fadeSlideUp 0.6s ease-out both; }
        .fade-up-d1 { animation: fadeSlideUp 0.6s ease-out 0.1s both; }
        .fade-up-d2 { animation: fadeSlideUp 0.6s ease-out 0.2s both; }
        .glow-card { animation: glowPulse 4s ease-in-out infinite; }
        .holo-border { animation: borderGlow 3s ease-in-out infinite; }
      `}</style>

      <Box sx={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at 50% 20%, rgba(68,255,68,0.04) 0%, transparent 60%)' }} />
      <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: '100%', pointerEvents: 'none', overflow: 'hidden' }}>
        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: 'linear-gradient(90deg, transparent, rgba(68,255,68,0.2), transparent)', animation: 'scanLine 6s linear infinite' }} />
      </Box>

      <Box sx={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, px: 2 }}>
        <Paper sx={{
          p: 4, bgcolor: 'rgba(15,15,15,0.95)', border: '1px solid rgba(68,255,68,0.15)',
          backdropFilter: 'blur(12px)', borderRadius: 3,
          boxShadow: '0 0 60px rgba(68,255,68,0.05)',
        }} className="fade-up glow-card">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 0.5 }}>
            <Box sx={{ width: 28, height: 28, borderRadius: 1, bgcolor: '#44FF44', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 15px rgba(68,255,68,0.3)' }}>
              <Typography sx={{ color: '#000', fontWeight: 'bold', fontSize: 14 }}>U</Typography>
            </Box>
            <Typography variant="h5" sx={{ color: '#44FF44', fontWeight: 'bold' }}>UkuloTrade</Typography>
          </Box>
          <Typography sx={{ color: '#555', mb: 3, textAlign: 'center', fontSize: 12, letterSpacing: 1 }}>
            CRIAR CONTA GRATUITA
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2, bgcolor: 'rgba(255,68,68,0.08)', color: '#FF4444', border: '1px solid rgba(255,68,68,0.2)', fontSize: 12 }}>{error}</Alert>}

          <form onSubmit={handleSubmit}>
            <TextField fullWidth label="Nome" value={name} onChange={e => setName(e.target.value)} required size="small"
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#222' }, '&:hover fieldset': { borderColor: 'rgba(68,255,68,0.5)' }, '&.Mui-focused fieldset': { borderColor: '#44FF44' } }, '& .MuiInputLabel-root': { color: '#555' }, '& .MuiInputLabel-root.Mui-focused': { color: '#44FF44' } }} />
            <TextField fullWidth label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required size="small"
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#222' }, '&:hover fieldset': { borderColor: 'rgba(68,255,68,0.5)' }, '&.Mui-focused fieldset': { borderColor: '#44FF44' } }, '& .MuiInputLabel-root': { color: '#555' }, '& .MuiInputLabel-root.Mui-focused': { color: '#44FF44' } }} />
            <TextField fullWidth label="Senha (min. 6 caracteres)" type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} required inputProps={{ minLength: 6 }} size="small"
              InputProps={{ endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} sx={{ color: showPassword ? '#44FF44' : '#555', p: 0.5 }}>
                    <span style={{ fontSize: 16 }}>{showPassword ? '🙈' : '👁'}</span>
                  </IconButton>
                </InputAdornment>
              )}}
              sx={{ mb: 2, '& .MuiOutlinedInput-root': { color: '#fff', '& fieldset': { borderColor: '#222' }, '&:hover fieldset': { borderColor: 'rgba(68,255,68,0.5)' }, '&.Mui-focused fieldset': { borderColor: '#44FF44' } }, '& .MuiInputLabel-root': { color: '#555' }, '& .MuiInputLabel-root.Mui-focused': { color: '#44FF44' } }} />

            <FormControlLabel
              control={<Checkbox checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                sx={{ color: '#555', '&.Mui-checked': { color: '#44FF44' } }} />}
              label={<Typography sx={{ color: '#666', fontSize: 11, lineHeight: 1.4 }}>
                Li e aceito os{' '}
                <Typography component="span" sx={{ color: '#44FF44', fontSize: 11 }}>Termos de Uso</Typography>
                {' '}e o{' '}
                <Typography component="span" sx={{ color: '#FFAA00', fontSize: 11 }}>Consentimento de Risco de Mercado</Typography>
              </Typography>}
              sx={{ mb: 2, alignItems: 'flex-start' }}
            />

            <Button fullWidth variant="contained" type="submit" disabled={loading}
              sx={{ bgcolor: '#44FF44', color: '#000', fontWeight: 'bold', py: 1, fontSize: 14, borderRadius: 2, textTransform: 'none', boxShadow: '0 0 20px rgba(68,255,68,0.15)', '&:hover': { bgcolor: '#33cc33', boxShadow: '0 0 30px rgba(68,255,68,0.25)' }, '&:disabled': { bgcolor: '#333', color: '#555' } }}>
              {loading ? <CircularProgress size={22} color="inherit" /> : 'Criar Conta'}
            </Button>
          </form>

          <Typography variant="body2" sx={{ mt: 2.5, textAlign: 'center', color: '#555', fontSize: 12 }}>
            Ja tem conta?{' '}
            <Link component="button" variant="body2" onClick={onToggle}
              sx={{ color: '#44FF44', textDecoration: 'none', fontSize: 12, '&:hover': { textDecoration: 'underline' } }}>
              Fazer login
            </Link>
          </Typography>
        </Paper>
      </Box>
    </Box>
  );
}
