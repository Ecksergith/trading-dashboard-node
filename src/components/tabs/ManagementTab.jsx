import { useState, useEffect } from 'react';
import { Box, Grid, Paper, Typography, Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel, Slider, TextField, Checkbox, FormGroup, Divider, Button, Chip, Snackbar, Alert } from '@mui/material';
import { useApp } from '../../context/AppContext';

export default function ManagementTab() {
  const { riskSettings, setRiskSettings, lotSettings, setLotSettings, aiAgentSettings, setAiAgentSettings, apiPost, positions, tradeHistory, autoTraderRunning, accountInfo } = useApp();
  const [localRisk, setLocalRisk] = useState(riskSettings);
  const [localLot, setLocalLot] = useState(lotSettings);
  const [localAI, setLocalAI] = useState(aiAgentSettings);
  const [savedOpen, setSavedOpen] = useState(false);

  useEffect(() => { setLocalRisk(riskSettings); }, [riskSettings]);
  useEffect(() => { setLocalLot(lotSettings); }, [lotSettings]);
  useEffect(() => { setLocalAI(aiAgentSettings); }, [aiAgentSettings]);

  const showSaved = () => setSavedOpen(true);

  const updateRisk = (key, value) => {
    const updated = { ...localRisk, [key]: value };
    setLocalRisk(updated);
    if (key === 'ifvg_stop_loss') {
      updated.ifvg_take_profit = value * (updated.risk_reward_ratio || 2);
      setLocalRisk(updated);
    }
    apiPost('/api/settings/risk', { [key]: value }).then(() => showSaved());
  };

  const updateLot = (key, value) => {
    setLocalLot(prev => ({ ...prev, [key]: value }));
    apiPost('/api/settings/lot', { [key]: value }).then(() => showSaved());
  };

  const dayNames = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado', 'Domingo'];

  return (
    <>
    <Grid container spacing={1}>
      {/* Risk Management */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Gerenciamento de Risco</Typography>

          <FormControl size="small" sx={{ mb: 1, minWidth: 200 }}>
            <InputLabel sx={{ color: '#888' }}>Modo de Lote</InputLabel>
            <Select value={localLot.mode} label="Modo de Lote" onChange={e => updateLot('mode', e.target.value)} sx={{ color: '#e0e0e0', fontSize: 12 }}>
              <MenuItem value="fixed" sx={{ fontSize: 12 }}>Fixo</MenuItem>
              <MenuItem value="monetary" sx={{ fontSize: 12 }}>Monetario</MenuItem>
              <MenuItem value="percentage" sx={{ fontSize: 12 }}>Percentual</MenuItem>
            </Select>
          </FormControl>

          {localLot.mode === 'fixed' && (
            <Box sx={{ mb: 1 }}>
              <TextField size="small" label="Lote Fixo" type="number" fullWidth sx={{ mb: 0.5 }}
                value={localLot.fixed_lot || 0.01}
                onChange={e => { const v = parseFloat(e.target.value) || 0.01; updateLot('fixed_lot', v); }}
                inputProps={{ min: 0.01, max: 100, step: 0.01 }}
                InputProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} InputLabelProps={{ sx: { color: '#888' } }} />
            </Box>
          )}

          {localLot.mode === 'monetary' && (
            <TextField size="small" label="Risco Monetario ($)" type="number" fullWidth sx={{ mb: 1 }}
              value={localLot.monetary_value || 100} onChange={e => updateLot('monetary_value', parseFloat(e.target.value))}
              InputProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} InputLabelProps={{ sx: { color: '#888' } }} />
          )}

          {localLot.mode === 'percentage' && (
            <TextField size="small" label="Risco por Trade (%)" type="number" fullWidth sx={{ mb: 1 }}
              value={localLot.percentage_value || 1} onChange={e => updateLot('percentage_value', parseFloat(e.target.value))}
              InputProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} InputLabelProps={{ sx: { color: '#888' } }} />
          )}

          <Divider sx={{ bgcolor: '#333', my: 1 }} />

          <FormControlLabel control={<Switch checked={localLot.use_lot_limits || false} size="small" onChange={e => updateLot('use_lot_limits', e.target.checked)} />}
            label={<Typography sx={{ fontSize: 11, color: localLot.use_lot_limits ? '#44FF44' : '#888' }}>Limitar Lote (Min/Max)</Typography>} />

          {localLot.use_lot_limits && (
            <Box sx={{ ml: 2, mb: 1, display: 'flex', gap: 1 }}>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 11, mb: 0.5 }}>Lote Min</Typography>
                <TextField size="small" type="number" value={localLot.min_lot || 0.01}
                  onChange={e => updateLot('min_lot', Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                  sx={{ width: '100%', '& input': { color: '#44FF44', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
                  inputProps={{ min: 0.01, max: 10, step: 0.01 }} />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 11, mb: 0.5 }}>Lote Max</Typography>
                <TextField size="small" type="number" value={localLot.max_lot || 5}
                  onChange={e => updateLot('max_lot', Math.max(0.01, parseFloat(e.target.value) || 0.01))}
                  sx={{ width: '100%', '& input': { color: '#FFAA00', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
                  inputProps={{ min: 0.01, max: 100, step: 0.01 }} />
              </Box>
            </Box>
          )}

          <Divider sx={{ bgcolor: '#333', my: 1 }} />

          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#888', fontSize: 11, mb: 0.5 }}>Risco/Recompensa (1:{localRisk.risk_reward_ratio || 2})</Typography>
              <TextField size="small" type="number" value={localRisk.risk_reward_ratio || 2}
                onChange={e => updateRisk('risk_reward_ratio', Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                sx={{ width: '100%', '& input': { color: '#FFAA00', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
                inputProps={{ min: 0.5, max: 10, step: 0.5 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#888', fontSize: 11, mb: 0.5 }}>Stop Loss (pts)</Typography>
              <TextField size="small" type="number" value={localRisk.ifvg_stop_loss || 50}
                onChange={e => updateRisk('ifvg_stop_loss', Math.max(1, parseInt(e.target.value) || 1))}
                sx={{ width: '100%', '& input': { color: '#FF4444', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
                inputProps={{ min: 1, max: 2000, step: 1 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ color: '#888', fontSize: 11, mb: 0.5 }}>Take Profit (pts)</Typography>
              <TextField size="small" type="number" value={localRisk.ifvg_take_profit || 100}
                onChange={e => updateRisk('ifvg_take_profit', Math.max(1, parseInt(e.target.value) || 1))}
                sx={{ width: '100%', '& input': { color: '#44FF44', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
                inputProps={{ min: 1, max: 5000, step: 1 }} />
            </Box>
          </Box>
        </Paper>
      </Grid>

      {/* Gerenciamento de Risco */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Gerenciamento de Risco</Typography>

          <FormControlLabel control={<Switch checked={localRisk.lot_trade || false} size="small" onChange={e => updateRisk('lot_trade', e.target.checked)} />}
            label={<Typography sx={{ fontSize: 11, color: '#888' }}>Lote por Trade</Typography>} />

          <FormControlLabel control={<Switch checked={localRisk.one_position_per_pair || false} size="small" onChange={e => updateRisk('one_position_per_pair', e.target.checked)} />}
            label={<Typography sx={{ fontSize: 11, color: localRisk.one_position_per_pair ? '#44FF44' : '#888' }}>Uma Ordem por Par</Typography>} />

          <Divider sx={{ bgcolor: '#333', my: 1 }} />

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ color: '#888', fontSize: 11 }}>Trades por Dia</Typography>
            <TextField size="small" type="number" value={localRisk.trade_per_day || 10}
              onChange={e => updateRisk('trade_per_day', Math.max(1, parseInt(e.target.value) || 1))}
              sx={{ width: 60, '& input': { color: '#44FF44', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
              inputProps={{ min: 1, max: 100, step: 1 }} />
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ color: '#888', fontSize: 11 }}>Max Posicoes (Global)</Typography>
            <TextField size="small" type="number" value={localRisk.max_positions || 5}
              onChange={e => updateRisk('max_positions', Math.max(1, parseInt(e.target.value) || 1))}
              sx={{ width: 60, '& input': { color: '#FF4444', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
              inputProps={{ min: 1, max: 50, step: 1 }} />
            <Typography sx={{ color: '#666', fontSize: 9 }}>Todas as posicoes MT5</Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography sx={{ color: '#888', fontSize: 11 }}>Max Ordens LLM</Typography>
            <TextField size="small" type="number" value={localRisk.max_llm_positions || 5}
              onChange={e => updateRisk('max_llm_positions', Math.max(1, parseInt(e.target.value) || 1))}
              sx={{ width: 60, '& input': { color: '#FFAA00', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
              inputProps={{ min: 1, max: 50, step: 1 }} />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: positions.length > 0 ? '#44FF44' : '#555', boxShadow: positions.length > 0 ? '0 0 6px #44FF44' : 'none' }} />
              <Typography sx={{ color: positions.length > 0 ? '#44FF44' : '#888', fontSize: 12, fontWeight: 'bold' }}>{positions.length}</Typography>
              <Typography sx={{ color: '#FFAA00', fontSize: 12, fontWeight: 'bold' }}>/</Typography>
              <Typography sx={{ color: '#FFAA00', fontSize: 12, fontWeight: 'bold' }}>{localRisk.max_llm_positions || 5}</Typography>
            </Box>
          </Box>

          <FormControlLabel control={<Switch checked={localRisk.max_loss_per_day_enabled || false} size="small" onChange={e => updateRisk('max_loss_per_day_enabled', e.target.checked)} />}
            label={<Typography sx={{ fontSize: 11, color: localRisk.max_loss_per_day_enabled ? '#FF4444' : '#888' }}>Limite de Perda Diaria</Typography>} />

          {localRisk.max_loss_per_day_enabled && (
            <Box sx={{ ml: 2, mb: 1, mt: 0.5 }}>
              <FormControlLabel control={<Switch checked={localRisk.max_loss_pct_enabled || false} size="small" onChange={e => updateRisk('max_loss_pct_enabled', e.target.checked)} />}
                label={<Typography sx={{ fontSize: 11, color: localRisk.max_loss_pct_enabled ? '#FF4444' : '#888' }}>Percentagem (%)</Typography>} />

              {localRisk.max_loss_pct_enabled && (
                <Box sx={{ ml: 2, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField size="small" type="number" value={localRisk.max_loss_per_day_pct || 5}
                    onChange={e => updateRisk('max_loss_per_day_pct', Math.max(0.5, parseFloat(e.target.value) || 0.5))}
                    sx={{ width: 80, '& input': { color: '#FF4444', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
                    inputProps={{ min: 0.5, max: 100, step: 0.5 }} />
                  {accountInfo?.balance > 0 && (
                    <Typography sx={{ color: '#666', fontSize: 9 }}>= ${((accountInfo.balance * ((localRisk.max_loss_per_day_pct || 5) / 100))).toFixed(2)} do saldo (${accountInfo.balance.toFixed(2)})</Typography>
                  )}
                </Box>
              )}

              {!localRisk.max_loss_pct_enabled && (
                <Box sx={{ ml: 2, mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField size="small" type="number" value={localRisk.max_loss_per_day || 100}
                    onChange={e => updateRisk('max_loss_per_day', Math.max(1, parseFloat(e.target.value) || 1))}
                    sx={{ width: 80, '& input': { color: '#FF4444', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
                    inputProps={{ min: 1, max: 10000, step: 10 }} />
                  <Typography sx={{ color: '#666', fontSize: 9 }}>USD</Typography>
                </Box>
              )}

              <Button size="small" variant="outlined" onClick={async () => {
                const res = await apiPost('/api/trades/reset-daily');
                if (res?.ok) showSaved();
              }} sx={{ color: '#FFAA00', borderColor: '#FFAA00', fontSize: 10, mt: 0.5, '&:hover': { borderColor: '#FFAA00', bgcolor: 'rgba(255,170,0,0.1)' } }}>
                Resetar P/L do Dia
              </Button>
            </Box>
          )}
        </Paper>
      </Grid>

      {/* Protecao com LLM */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Protecao com LLM</Typography>

          <FormControlLabel control={<Switch checked={localRisk.llm_position_protection || false} size="small" onChange={e => updateRisk('llm_position_protection', e.target.checked)} />}
            label={<Typography sx={{ fontSize: 11, color: localRisk.llm_position_protection ? '#44FF44' : '#888' }}>Ativar protecao de posicoes</Typography>} />

          {localRisk.llm_position_protection && (
            <Box sx={{ ml: 2, mb: 1, mt: 0.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <Typography sx={{ color: '#888', fontSize: 11 }}>Intervalo (seg)</Typography>
                <TextField size="small" type="number" value={localRisk.llm_protection_interval || 60}
                  onChange={e => updateRisk('llm_protection_interval', Math.max(5, parseInt(e.target.value) || 5))}
                  sx={{ width: 70, '& input': { color: '#44FF44', fontSize: 12, textAlign: 'center', p: '4px 6px' }, '& fieldset': { borderColor: '#444' } }}
                  inputProps={{ min: 5, max: 600, step: 5 }} />
              </Box>

              <Typography sx={{ color: '#888', fontSize: 11, mb: 0.5, mt: 1 }}>Acoes permitidas:</Typography>

              <FormControlLabel control={<Switch checked={localRisk.llm_allow_breakeven !== false} size="small" onChange={e => updateRisk('llm_allow_breakeven', e.target.checked)} />}
                label={<Typography sx={{ fontSize: 11, color: '#888' }}>Mover SL para Breakeven</Typography>} />

              <FormControlLabel control={<Switch checked={localRisk.llm_allow_move_sl_profit !== false} size="small" onChange={e => updateRisk('llm_allow_move_sl_profit', e.target.checked)} />}
                label={<Typography sx={{ fontSize: 11, color: '#888' }}>Mover SL para Lucro</Typography>} />

              <FormControlLabel control={<Switch checked={localRisk.llm_allow_partial_close !== false} size="small" onChange={e => updateRisk('llm_allow_partial_close', e.target.checked)} />}
                label={<Typography sx={{ fontSize: 11, color: '#888' }}>Fechamento Parcial</Typography>} />

              <FormControlLabel control={<Switch checked={localRisk.llm_allow_close !== false} size="small" onChange={e => updateRisk('llm_allow_close', e.target.checked)} />}
                label={<Typography sx={{ fontSize: 11, color: '#888' }}>Fechamento Total</Typography>} />
            </Box>
          )}
        </Paper>
      </Grid>

      {/* LLM Config */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Configuracao LLM</Typography>

          <FormControl size="small" sx={{ mb: 1, minWidth: 200 }}>
            <InputLabel sx={{ color: '#888' }}>Provider</InputLabel>
            <Select value={localAI.provider || 'openrouter'} label="Provider"
              onChange={e => { setLocalAI(prev => ({ ...prev, provider: e.target.value })); apiPost('/api/ai-agent/settings', { provider: e.target.value }).then(() => showSaved()); }}
              sx={{ color: '#e0e0e0', fontSize: 12 }}>
              <MenuItem value="openrouter" sx={{ fontSize: 12 }}>OpenRouter</MenuItem>
              <MenuItem value="gemini" sx={{ fontSize: 12 }}>Gemini</MenuItem>
              <MenuItem value="ollama" sx={{ fontSize: 12 }}>Ollama (Local)</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ mb: 1, minWidth: 200 }}>
            <InputLabel sx={{ color: '#888' }}>Modelo</InputLabel>
            <Select value={localAI.model || 'openrouter/free'} label="Modelo"
              onChange={e => { setLocalAI(prev => ({ ...prev, model: e.target.value })); apiPost('/api/ai-agent/settings', { model: e.target.value }).then(() => showSaved()); }}
              sx={{ color: '#e0e0e0', fontSize: 12 }}>
              <MenuItem value="openrouter/free" sx={{ fontSize: 12 }}>Free Models Router</MenuItem>
              <MenuItem value="claude-3.5-sonnet" sx={{ fontSize: 12 }}>Claude 3.5 Sonnet</MenuItem>
              <MenuItem value="gpt-4o" sx={{ fontSize: 12 }}>GPT-4o</MenuItem>
              <MenuItem value="gpt-4-turbo" sx={{ fontSize: 12 }}>GPT-4 Turbo</MenuItem>
              <MenuItem value="llama-3.1-405b" sx={{ fontSize: 12 }}>Llama 3.1 405B</MenuItem>
              <MenuItem value="mistral-large" sx={{ fontSize: 12 }}>Mistral Large</MenuItem>
              <MenuItem value="gemini-pro" sx={{ fontSize: 12 }}>Gemini Pro</MenuItem>
              <MenuItem value="deepseek-chat" sx={{ fontSize: 12 }}>DeepSeek Chat</MenuItem>
              <MenuItem value="qwen-72b" sx={{ fontSize: 12 }}>Qwen 72B</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ mb: 1, minWidth: 200 }}>
            <InputLabel sx={{ color: '#888' }}>Aggressividade</InputLabel>
            <Select value={localAI.aggressiveness || 'Moderado'} label="Aggressividade"
              onChange={e => { setLocalAI(prev => ({ ...prev, aggressiveness: e.target.value })); apiPost('/api/ai-agent/settings', { aggressiveness: e.target.value }).then(() => showSaved()); }}
              sx={{ color: '#e0e0e0', fontSize: 12 }}>
              <MenuItem value="Conservador" sx={{ fontSize: 12 }}>Conservador</MenuItem>
              <MenuItem value="Moderado" sx={{ fontSize: 12 }}>Moderado</MenuItem>
              <MenuItem value="Agressivo" sx={{ fontSize: 12 }}>Agressivo</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ mb: 1, minWidth: 200 }}>
            <InputLabel sx={{ color: '#888' }}>Estrategia LLM</InputLabel>
            <Select value={localAI.strategy || 'ict_smc'} label="Estrategia LLM"
              onChange={e => { setLocalAI(prev => ({ ...prev, strategy: e.target.value })); apiPost('/api/ai-agent/settings', { strategy: e.target.value }).then(() => showSaved()); }}
              sx={{ color: '#e0e0e0', fontSize: 12 }}>
              <MenuItem value="ict_smc" sx={{ fontSize: 12 }}>ICT/SMC</MenuItem>
              <MenuItem value="mml_erl_irl" sx={{ fontSize: 12 }}>MML (ERL/IRL)</MenuItem>
              <MenuItem value="mmxm" sx={{ fontSize: 12 }}>MMXM (Market Maker Model)</MenuItem>
              <MenuItem value="crt" sx={{ fontSize: 12 }}>CRT (Candle Range Theory)</MenuItem>
              <MenuItem value="fvg_strategy" sx={{ fontSize: 12 }}>IFVG (Inverse FVG)</MenuItem>
              <MenuItem value="price_action" sx={{ fontSize: 12 }}>Price Action</MenuItem>
              <MenuItem value="custom" sx={{ fontSize: 12 }}>Custom</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ mb: 1, minWidth: 200 }}>
            <InputLabel sx={{ color: '#888' }}>Idioma do LLM</InputLabel>
            <Select value={localAI.language || 'pt'} label="Idioma do LLM"
              onChange={e => { setLocalAI(prev => ({ ...prev, language: e.target.value })); apiPost('/api/ai-agent/settings', { language: e.target.value }).then(() => showSaved()); }}
              sx={{ color: '#e0e0e0', fontSize: 12 }}>
              <MenuItem value="pt" sx={{ fontSize: 12 }}>Portugues (BR)</MenuItem>
              <MenuItem value="en" sx={{ fontSize: 12 }}>English</MenuItem>
              <MenuItem value="es" sx={{ fontSize: 12 }}>Espanol</MenuItem>
              <MenuItem value="fr" sx={{ fontSize: 12 }}>Francais</MenuItem>
              <MenuItem value="de" sx={{ fontSize: 12 }}>Deutsch</MenuItem>
              <MenuItem value="zh" sx={{ fontSize: 12 }}>Chines (Mandarim)</MenuItem>
              <MenuItem value="ja" sx={{ fontSize: 12 }}>Japones</MenuItem>
              <MenuItem value="ko" sx={{ fontSize: 12 }}>Coreano</MenuItem>
              <MenuItem value="ar" sx={{ fontSize: 12 }}>Arabe</MenuItem>
              <MenuItem value="ru" sx={{ fontSize: 12 }}>Russo</MenuItem>
            </Select>
          </FormControl>

          <TextField size="small" label="OpenRouter API Key" type="password" fullWidth sx={{ mb: 1 }}
            value={localAI.apiKeys?.openrouter || ''}
            onChange={e => setLocalAI(prev => ({ ...prev, apiKeys: { ...prev.apiKeys, openrouter: e.target.value } }))}
            onBlur={e => { const key = e.target.value; apiPost('/api/ai-agent/settings', { apiKeys: { openrouter: key } }).then(() => showSaved()); }}
            InputProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} InputLabelProps={{ sx: { color: '#888' } }} />

          <Button variant="outlined" size="small" sx={{ color: '#44FF44', borderColor: '#44FF44', fontSize: 11 }}
            onClick={() => apiPost('/api/ai-agent/settings', localAI).then(() => showSaved())}>
            Salvar Configuracoes
          </Button>
        </Paper>
      </Grid>

      {/* Trading Time */}
      <Grid item xs={12} md={6}>
        <Paper sx={{ p: 1.5, bgcolor: '#1a1a1a' }}>
          <Typography variant="caption" sx={{ color: '#44FF44', fontWeight: 'bold', display: 'block', mb: 1 }}>Controle de Horario</Typography>

          <FormControlLabel control={<Switch checked={localRisk.time_control_enabled || false} size="small" onChange={e => updateRisk('time_control_enabled', e.target.checked)} />}
            label={<Typography sx={{ fontSize: 11, color: '#888' }}>Controle de Horario Ativo</Typography>} />

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
            {dayNames.map(day => (
              <FormControlLabel key={day}
                control={<Checkbox size="small" checked={localRisk.trading_days?.[day] || false}
                  onChange={e => {
                    const days = { ...(localRisk.trading_days || {}), [day]: e.target.checked };
                    updateRisk('trading_days', days);
                  }}
                  sx={{ color: '#888', '&.Mui-checked': { color: '#44FF44' } }} />}
                label={<Typography sx={{ fontSize: 10, color: '#888' }}>{day.slice(0, 3)}</Typography>}
              />
            ))}
          </Box>

          <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
            <TextField size="small" label="Inicio" type="time" value={localRisk.start_time || '14:30'}
              onChange={e => updateRisk('start_time', e.target.value)} fullWidth
              InputProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} InputLabelProps={{ sx: { color: '#888' } }} />
            <TextField size="small" label="Fim" type="time" value={localRisk.end_time || '22:30'}
              onChange={e => updateRisk('end_time', e.target.value)} fullWidth
              InputProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} InputLabelProps={{ sx: { color: '#888' } }} />
          </Box>

          <Divider sx={{ bgcolor: '#333', my: 1 }} />

          <FormControlLabel control={<Switch checked={localRisk.auto_close_orders || false} size="small" onChange={e => updateRisk('auto_close_orders', e.target.checked)} />}
            label={<Typography sx={{ fontSize: 11, color: '#888' }}>Auto Fechar Ordens na Sexta</Typography>} />

          {localRisk.auto_close_orders && (
            <TextField size="small" label="Horario Fechamento" type="time" value={localRisk.auto_close_time || '22:30'}
              onChange={e => updateRisk('auto_close_time', e.target.value)} sx={{ mt: 0.5 }}
              InputProps={{ sx: { color: '#e0e0e0', fontSize: 12 } }} InputLabelProps={{ sx: { color: '#888' } }} />
          )}
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
