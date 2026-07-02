import { useState, Component } from 'react';
import { ThemeProvider, createTheme, CssBaseline, CircularProgress, Box, Typography, Paper } from '@mui/material';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import Dashboard from './components/Dashboard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#44FF44' },
    secondary: { main: '#FF4444' },
    background: { default: '#121212', paper: '#1e1e1e' },
    success: { main: '#44FF44' },
    error: { main: '#FF4444' },
    warning: { main: '#FFAA00' },
  },
  typography: {
    fontFamily: '"Roboto", "Consolas", monospace',
    fontSize: 13,
  },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiTableCell: { styleOverrides: { root: { borderBottom: '1px solid #333' } } },
  },
});

class ErrorBoundary extends Component {
  state = { error: null, info: null };
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) { this.setState({ info }); console.error('[ErrorBoundary]', error, info); }
  render() {
    if (this.state.error) {
      return (
        <Box sx={{ minHeight: '100vh', bgcolor: '#121212', p: 3 }}>
          <Paper sx={{ p: 3, bgcolor: '#1e1e1e', border: '1px solid #FF4444', maxWidth: 700 }}>
            <Typography variant="h6" sx={{ color: '#FF4444', mb: 1 }}>Erro no Dashboard</Typography>
            <Typography sx={{ color: '#ff6b6b', mb: 1, fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
              {this.state.error?.message || String(this.state.error)}
            </Typography>
            <Typography sx={{ color: '#888', fontSize: 11, whiteSpace: 'pre-wrap', maxHeight: 300, overflow: 'auto' }}>
              {this.state.info?.componentStack || ''}
            </Typography>
          </Paper>
        </Box>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, loading } = useAuth();
  const [authPage, setAuthPage] = useState('login');

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: '#121212' }}>
        <CircularProgress sx={{ color: '#44FF44' }} />
      </Box>
    );
  }

  if (!user) {
    if (authPage === 'register') {
      return <RegisterPage onToggle={() => setAuthPage('login')} />;
    }
    return <LoginPage onToggle={() => setAuthPage('register')} />;
  }

  return (
    <AppProvider>
      <Dashboard />
    </AppProvider>
  );
}

function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <ErrorBoundary>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ErrorBoundary>
    </ThemeProvider>
  );
}

export default App;
