import { useState, useEffect, useRef } from 'react';
import { Box, Grid, Paper, Typography, TextField, Button, Chip, Snackbar, Alert, Select, MenuItem, FormControl, InputLabel, Divider, LinearProgress } from '@mui/material';
import { useApp } from '../../context/AppContext';

function cleanReason(text) {
  if (!text || typeof text !== 'string') return '';
  if (text.startsWith('{') || text.startsWith('`')) {
    const m = text.match(/"reason"[:\s]*"([^"]+)"/i);
    return m ? m[1] : '';
  }
  return text;
}

const DEFAULT_PROMPTS = {
  ict_smc: `Voce e um analista tecnico de price action e liquidez (ICT/SMC).

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Escreva uma analise detalhada e natural, como se estivesse conversando com um colega trader. Mentione observacoes especificas dos dados: niveis de preco, estrutura de mercado, pontos de liquidez, zonas de premium/discount. Minimo 3 frases de justificativa.

Exemplo:
BULLISH - O preco esta em zona de desconto (abaixo de 50% do range recente) com rejeicao clara na baixa, formando wick longa. Ha sinais de acumulacao smart money com volume crescente e equal lows formando liquidez embaixo. A estrutura de mercado mostra BOS bullish no M15, confirmando a direcao.`,
  mml_erl_irl: `Voce e um analista tecnico de MML (Market Maker Logic).

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Escreva uma analise detalhada e natural, mencionando observacoes especificas: niveis de ERL/IRL, zonas de acumulacao/distribuicao, consolidacao antes de distribuicao (CSD). Minimo 3 frases.

Exemplo:
BEARISH - O preco esta acima de 50% do range (zona de premium), onde o smart money comeca a distribuir. Identificou-se CSD (Consolidation Before Distribution) com equal highs formando liquidez acima. O IRL interno foi testado e rejeitado, indicando pressao vendedora institucional.`,
  fvg_strategy: `Voce e um analista tecnico de IFVG (Inverse Fair Value Gap) - LuxAlgo.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Considere IFVG como sinais de REVERSAO: Bullish IFVG = preco fecha abaixo de FVG bearish (invalidacao) = COMPRA. Bearish IFVG = preco fecha acima de FVG bullish (invalidacao) = VENDA.

Escreva uma analise detalhada e natural, mencionando os IFVGs especificos e por que representam oportunidade. Minimo 3 frases.

Exemplo:
BULLISH - Identificou-se um FVG SIBI (bearish) que foi invalidado quando o preco fechou abaixo dele, criando um Bullish IFVG. O sweep de liquidez nos equal lows antes da invalidacao confirma a manipulacao smart money. A confluencia com o M15 mostra BOS bullish, aumentando a confiabilidade do sinal.`,
  crt: `Voce e um analista tecnico de Candle Range Theory (CRT).

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Considere: range do candle, corpo vs sombra, candle anterior como referencia. Preco acima do high = BULLISH. Preco abaixo do low = BEARISH. Wick longa = rejeicao.

Escreva uma analise detalhada e natural, explicando os ranges observados. Minimo 3 frases.

Exemplo:
BULLISH - O candle atual fechou acima do high do candle anterior, indicando expansao na alta. A wick longa em baixo mostra rejeicao forte da zona de suporte, com pressao compradora dominante. O range do candle atual e maior que o anterior, confirmando momentum crescente na direcao da compra.`,
  mmxm: `Voce e um analista tecnico de Market Maker Model (MMXM) - ICT.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

MMXM identifica fases: Accumulation > Manipulation > Distribution/Expansion.

Escreva uma analise detalhada e natural, explicando qual fase do ciclo esta ocorrendo. Minimo 3 frases.

Exemplo:
BULLISH - Estamos na fase de EXPANSION apos o smart money completar a Accumulation e Manipulation. O sweep de liquidez nos equal lows capturou os stops dos vendedores, e agora o BOS bullish confirma a saida da acumulacao. O preco esta em zona de discount no retrace, oferecendo entrada ideal com risco controlado.`,
  price_action: `Voce e um analista tecnico de Price Action.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Considere: Engulfing, Pin Bar, Doji, Hammer, Inside Bar, suporte/resistencia.

Escreva uma analise detalhada e natural, mencionando os padroes especificos identificados. Minimo 3 frases.

Exemplo:
BEARISH - Formou-se um Engulfing bearish forte na zona de resistencia, com o candle atual engolindo completamente o anterior. A wick longa em cima mostra rejeicao clara dos compradores, e o corpo grande indica pressao vendedora dominante. O rompimento do suporte imediato confirma a continuacao da queda.`,
};

export default function AIAgentTab() {
  const { aiAgentSettings, setAiAgentSettings, pairs, apiPost, apiGet } = useApp();
  const [llmStatus, setLlmStatus] = useState({ connected: false, provider: '', model: '' });
  const [agentLog, setAgentLog] = useState([]);
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [savedOpen, setSavedOpen] = useState(false);
  const logRef = useRef(null);

  const [selectedPair, setSelectedPair] = useState(pairs[0] || 'EURUSD');
  const [analyzing, setAnalyzing] = useState(false);
  const [lastAnalysis, setLastAnalysis] = useState(null);
  const [analysisHistory, setAnalysisHistory] = useState([]);

  const currentStrategy = aiAgentSettings.strategy || 'ict_smc';
  const defaultPrompt = DEFAULT_PROMPTS[currentStrategy] || DEFAULT_PROMPTS.ict_smc;
  const isPromptModified = testPrompt !== defaultPrompt;

  useEffect(() => {
    const fetchStatus = async () => {
      const status = await apiGet('/api/ai-agent/status');
      if (status) setLlmStatus(status);
    };
    fetchStatus();
    const t = setInterval(fetchStatus, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (aiAgentSettings.defaultPrompt) {
      setTestPrompt(aiAgentSettings.defaultPrompt);
    } else {
      setTestPrompt(defaultPrompt);
    }
  }, [aiAgentSettings.defaultPrompt, currentStrategy]);

  useEffect(() => {
    fetchHistory();
    const t = setInterval(fetchHistory, 15000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (pairs.length > 0 && !selectedPair) {
      setSelectedPair(pairs[0]);
    }
  }, [pairs]);

  const fetchHistory = async () => {
    const data = await apiGet('/api/llm/history?limit=30');
    if (data) setAnalysisHistory(data);
  };

  const testConnection = async () => {
    const result = await apiPost('/api/llm/test', {
      provider: aiAgentSettings.provider || 'openrouter',
      apiKey: aiAgentSettings.apiKeys?.openrouter || '',
    });
    setLlmStatus(prev => ({ ...prev, connected: result?.ok || false }));
    setAgentLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `Teste de conexao: ${result?.ok ? 'Sucesso' : 'Falha - ' + (result?.error || '')}`, level: result?.ok ? 'success' : 'error' }]);
  };

  const testLLM = async () => {
    if (!testPrompt.trim()) return;
    setAgentLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `Enviando: ${testPrompt.slice(0, 80)}...`, level: 'info' }]);
    const result = await apiPost('/api/llm/analyze', {
      provider: aiAgentSettings.provider || 'openrouter',
      apiKey: aiAgentSettings.apiKeys?.openrouter || '',
      model: aiAgentSettings.model || 'openrouter/free',
      prompt: testPrompt,
    });
    setTestResponse(result?.response || result?.error || 'Sem resposta');
    setAgentLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `Resposta: ${(result?.response || '').slice(0, 200)}`, level: result?.ok ? 'success' : 'error' }]);
  };

  const savePrompt = async () => {
    await apiPost('/api/ai-agent/settings', { ...aiAgentSettings, defaultPrompt: testPrompt });
    setSavedOpen(true);
  };

  const resetPrompt = () => {
    setTestPrompt(defaultPrompt);
  };

  const runTradeAnalysis = async () => {
    if (!selectedPair || analyzing) return;
    setAnalyzing(true);
    setLastAnalysis(null);
    setAgentLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `Analisando ${selectedPair} via LLM...`, level: 'info' }]);

    const result = await apiPost('/api/llm/trade-analysis', { pair: selectedPair });

    if (result?.ok) {
      setLastAnalysis(result);
      const a = result.analysis;
      const actionLabel = { buy: 'COMPRA', sell: 'VENDA', wait: 'AGUARDAR', close: 'FECHAR' };
      const tradeStatus = result.trade?.status === 'success' ? ' | Ordem Executada!' : (result.trade ? ` | Erro: ${result.trade?.error}` : ' | Sem execucao');
      setAgentLog(prev => [...prev, {
        time: new Date().toLocaleTimeString(),
        msg: `${selectedPair}: ${actionLabel[a.action] || a.action.toUpperCase()} | Conf: ${(a.confidence * 100).toFixed(0)}%${tradeStatus} | ${cleanReason(a.reason)?.slice(0, 100) || ''}`,
        level: a.action === 'wait' ? 'warning' : (result.trade?.status === 'success' ? 'success' : 'info'),
      }]);
      fetchHistory();
    } else {
      setAgentLog(prev => [...prev, { time: new Date().toLocaleTimeString(), msg: `Erro na analise: ${result?.error || 'Falha'}`, level: 'error' }]);
    }
    setAnalyzing(false);
  };

  const logColor = (level) => {
    if (level === 'success') return '#44FF44';
    if (level === 'error') return '#FF4444';
    if (level === 'warning') return '#FFAA00';
    return '#888';
  };

  const actionColor = (action) => {
    if (action === 'buy') return '#44FF44';
    if (action === 'sell') return '#FF4444';
    if (action === 'close') return '#FF8800';
    return '#888';
  };

  const formatTime = (ts) => {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <>
    <Grid container spacing={1}>
      <Grid item xs={12} md={3}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Status da Conexao LLM</Typography>

          <Box sx={{ display: 'grid', gap: 0.5, mb: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#888', fontSize: 11 }}>Provider</Typography>
              <Chip size="small" label={aiAgentSettings.provider || 'openrouter'} sx={{ bgcolor: '#2a2a2a', fontSize: 10 }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#888', fontSize: 11 }}>Modelo</Typography>
              <Chip size="small" label={aiAgentSettings.model || 'openrouter/free'} sx={{ bgcolor: '#2a2a2a', fontSize: 10 }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#888', fontSize: 11 }}>Estrategia</Typography>
              <Chip size="small" label={currentStrategy.toUpperCase()} sx={{ bgcolor: '#2a2a2a', fontSize: 10 }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#888', fontSize: 11 }}>API Key</Typography>
              <Chip size="small" label={aiAgentSettings.apiKeys?.openrouter ? 'Configurada' : 'Nao configurada'}
                sx={{ bgcolor: '#2a2a2a', color: aiAgentSettings.apiKeys?.openrouter ? '#44FF44' : '#FF4444', fontSize: 10 }} />
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#888', fontSize: 11 }}>Status</Typography>
              <Chip size="small"
                label={llmStatus.connected ? 'Conectado' : 'Desconectado'}
                sx={{ bgcolor: '#2a2a2a', color: llmStatus.connected ? '#44FF44' : '#FF4444', fontSize: 10 }} />
            </Box>
          </Box>

          <Button variant="outlined" size="small" fullWidth onClick={testConnection}
            sx={{ color: '#44FF44', borderColor: '#44FF44', fontSize: 11 }}>
            Testar Conexao
          </Button>
        </Paper>
      </Grid>

      <Grid item xs={12} md={5}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Analise LLM + Execucao MT5</Typography>

          <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel sx={{ color: '#888' }}>Par</InputLabel>
              <Select value={selectedPair} label="Par" onChange={e => setSelectedPair(e.target.value)}
                sx={{ color: '#e0e0e0', fontSize: 12 }}>
                {pairs.map(p => <MenuItem key={p} value={p} sx={{ fontSize: 12 }}>{p}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="contained" size="small" onClick={runTradeAnalysis} disabled={analyzing}
              sx={{ bgcolor: '#44FF44', color: '#000', '&:hover': { bgcolor: '#33cc33' }, fontSize: 11, minWidth: 120 }}>
              {analyzing ? 'Analisando...' : 'Analisar e Operar'}
            </Button>
          </Box>

          {analyzing && <LinearProgress sx={{ mb: 1, bgcolor: '#2a2a2a', '& .MuiLinearProgress-bar': { bgcolor: '#44FF44' } }} />}

          {lastAnalysis?.analysis && (
            <Paper sx={{ p: 1, bgcolor: '#121212', mb: 1 }}>
              <Box sx={{ display: 'flex', gap: 0.5, mb: 0.5, flexWrap: 'wrap' }}>
                <Chip size="small" label={`${lastAnalysis.analysis.action?.toUpperCase()}`}
                  sx={{ bgcolor: actionColor(lastAnalysis.analysis.action), color: '#000', fontSize: 10, fontWeight: 'bold' }} />
                <Chip size="small" label={`Conf: ${(lastAnalysis.analysis.confidence * 100).toFixed(0)}%`}
                  sx={{ bgcolor: '#2a2a2a', color: '#e0e0e0', fontSize: 10 }} />
                {lastAnalysis.analysis.entry_price && (
                  <Chip size="small" label={`Entry: ${lastAnalysis.analysis.entry_price}`}
                    sx={{ bgcolor: '#2a2a2a', color: '#e0e0e0', fontSize: 10 }} />
                )}
                {lastAnalysis.analysis.stop_loss && (
                  <Chip size="small" label={`SL: ${lastAnalysis.analysis.stop_loss}`}
                    sx={{ bgcolor: '#2a2a2a', color: '#FF4444', fontSize: 10 }} />
                )}
                {lastAnalysis.analysis.take_profit && (
                  <Chip size="small" label={`TP: ${lastAnalysis.analysis.take_profit}`}
                    sx={{ bgcolor: '#2a2a2a', color: '#44FF44', fontSize: 10 }} />
                )}
                {lastAnalysis.trade?.status === 'success' && (
                  <Chip size="small" label={`Ticket: #${lastAnalysis.trade.ticket}`}
                    sx={{ bgcolor: '#44FF44', color: '#000', fontSize: 10, fontWeight: 'bold' }} />
                )}
              </Box>
              <Typography sx={{ color: '#aaa', fontSize: 10, fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap' }}>
                {cleanReason(lastAnalysis.analysis.reason)}
              </Typography>
              {lastAnalysis.llm_raw && (
                <Box sx={{ mt: 0.5 }}>
                  <Typography sx={{ color: '#888', fontSize: 10, mb: 0.25 }}>Resposta bruta LLM:</Typography>
                  <Typography sx={{ color: '#aaa', fontSize: 10, fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap', maxHeight: 80, overflow: 'auto' }}>
                    {lastAnalysis.llm_raw}
                  </Typography>
                </Box>
              )}
            </Paper>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={4}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold' }}>Testar LLM</Typography>
            {isPromptModified && (
              <Chip size="small" label="Modificado" sx={{ bgcolor: 'rgba(255,170,0,0.15)', color: '#FFAA00', fontSize: 9, height: 18 }} />
            )}
          </Box>

          <Typography sx={{ color: '#666', fontSize: 9, mb: 0.5 }}>
            Prompt padrao: {currentStrategy.toUpperCase()}
          </Typography>

          <TextField
            size="small"
            label="Prompt de teste"
            fullWidth
            multiline
            rows={10}
            sx={{ mb: 1, '& .MuiInputBase-root': { fontSize: 11 } }}
            value={testPrompt}
            onChange={e => setTestPrompt(e.target.value)}
            InputProps={{ sx: { color: '#e0e0e0', fontSize: 11, fontFamily: 'Consolas, monospace', lineHeight: 1.4 } }}
            InputLabelProps={{ sx: { color: '#888' } }}
          />

          <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
            <Button variant="outlined" size="small" fullWidth onClick={testLLM}
              sx={{ color: '#44FF44', borderColor: '#44FF44', fontSize: 11 }}>
              Enviar Teste
            </Button>
            <Button variant="contained" size="small" fullWidth onClick={savePrompt}
              sx={{ bgcolor: '#FFAA00', color: '#000', '&:hover': { bgcolor: '#cc8800' }, fontSize: 11 }}>
              Salvar Prompt
            </Button>
          </Box>

          <Button variant="outlined" size="small" fullWidth onClick={resetPrompt}
            sx={{ color: isPromptModified ? '#FF4444' : '#666', borderColor: isPromptModified ? '#FF4444' : '#444', fontSize: 10, mb: 1, '&:hover': { borderColor: isPromptModified ? '#FF6666' : '#666', bgcolor: isPromptModified ? 'rgba(255,68,68,0.05)' : 'transparent' } }}>
            Restaurar Prompt Padrao
          </Button>

          {testResponse && (
            <Paper sx={{ p: 1, bgcolor: '#2a2a2a', maxHeight: 120, overflow: 'auto' }}>
              <Typography sx={{ color: '#44FF44', fontSize: 10, fontFamily: 'Consolas, monospace', whiteSpace: 'pre-wrap' }}>{testResponse}</Typography>
            </Paper>
          )}
        </Paper>
      </Grid>
    </Grid>

    <Grid container spacing={1} sx={{ mt: 0.5 }}>
      <Grid item xs={12} md={7}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Historico de Analises LLM</Typography>
          {analysisHistory.length === 0 ? (
            <Typography sx={{ color: '#555', fontSize: 11, textAlign: 'center', mt: 2 }}>Nenhuma analise registrada</Typography>
          ) : (
            <Box sx={{ maxHeight: 200, overflow: 'auto' }}>
              {analysisHistory.map((h, i) => (
                <Box key={i} sx={{ display: 'flex', gap: 0.5, alignItems: 'center', mb: 0.25, bgcolor: '#121212', borderRadius: 0.5, p: 0.5 }}>
                  <Typography sx={{ color: '#aaa', fontSize: 10, fontFamily: 'Consolas, monospace', minWidth: 65 }}>{formatTime(h.time)}</Typography>
                  <Chip size="small" label={h.pair} sx={{ bgcolor: '#2a2a2a', fontSize: 10, height: 20 }} />
                  <Chip size="small" label={h.action?.toUpperCase()} sx={{ bgcolor: actionColor(h.action), color: '#000', fontSize: 10, height: 20, fontWeight: 'bold' }} />
                  <Typography sx={{ color: '#ccc', fontSize: 10 }}>{(h.confidence * 100).toFixed(0)}%</Typography>
                  <Chip size="small"
                    label={h.status === 'executed' ? `#${h.ticket}` : 'skip'}
                    sx={{ bgcolor: h.status === 'executed' ? '#44FF44' : '#555', color: h.status === 'executed' ? '#000' : '#bbb', fontSize: 10, height: 20 }} />
                  <Typography sx={{ color: '#ccc', fontSize: 10, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                    {cleanReason(h.reason)?.slice(0, 80) || ''}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Grid>

      <Grid item xs={12} md={5}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a', height: 310 }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Log de Atividade</Typography>
          <Box ref={logRef} sx={{ height: 'calc(100% - 25px)', overflow: 'auto', bgcolor: '#121212', borderRadius: 1, p: 0.5 }}>
            {agentLog.length === 0 && (
              <Typography sx={{ color: '#555', fontSize: 11, textAlign: 'center', mt: 2 }}>Nenhuma atividade registrada</Typography>
            )}
            {agentLog.map((entry, i) => (
              <Typography key={i} sx={{ color: logColor(entry.level), fontSize: 10, fontFamily: 'Consolas, monospace', mb: 0.25 }}>
                [{entry.time}] {entry.msg}
              </Typography>
            ))}
          </Box>
        </Paper>
      </Grid>
    </Grid>

      <Snackbar open={savedOpen} autoHideDuration={2000} onClose={() => setSavedOpen(false)} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={() => setSavedOpen(false)} severity="success" variant="filled" sx={{ width: '100%', bgcolor: '#44FF44', color: '#000', fontWeight: 'bold' }}>
          Dados salvos com sucesso!
        </Alert>
      </Snackbar>
    </>
  );
}
