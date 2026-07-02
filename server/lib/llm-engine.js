import { loadJSON, saveJSON, resolveModelId, DATA_DIR, getDecimals, getSymbolType } from './constants.js';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { getTradeMemory, getTradeMemoryStats, getRecentTradeReasons } from './db.js';
import { generateAdaptivePromptAddition, getAdaptiveThreshold } from './llm-self-improve.js';

const LANGUAGES = {
  pt: 'Portugues do Brasil',
  en: 'English',
  es: 'Espanol',
  fr: 'Francais',
  de: 'Deutsch',
  zh: 'Chines (Mandarim)',
  ja: 'Japones',
  ko: 'Coreano',
  ar: 'Arabe',
  ru: 'Russo',
};

const SYSTEM_PROMPTS = {
  ict_smc: `Voce e um analista tecnico de price action e liquidez (ICT/SMC).

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Escreva uma analise detalhada e natural, como se estivesse conversando com um colega trader. Mentione observacoes especificas dos dados: niveis de preco, estrutura de mercado, pontos de liquidez, zonas de premium/discount. Minimo 3 frases de justificativa.

Responda no formato:
BULLISH ou BEARISH - analise detalhada com observacoes especificas dos dados
CONFIDENCIA: nivel de confianca (1-10)
ENTRY: preco de entrada sugerido
SL: distancia em pips para stop loss
TP: distancia em pips para take profit

Considere o contexto de risco: {risk_settings}
Considere o historico recente: {history}
Par analisado: {pair}`,

  mml_erl_irl: `Voce e um analista especializado em Market Maker Logic (MML) com conceitos ERL/IRL.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Escreva uma analise detalhada e natural, mencionando observacoes especificas dos dados: niveis de ERL/IRL, zonas de acumulacao/distribuicao, consolidacao antes de distribuicao (CSD). Minimo 3 frases de justificativa.

Responda no formato:
BULLISH ou BEARISH - analise detalhada com fundamentos MML/ERL/IRL
CONFIDENCIA: nivel de confianca (1-10)
ENTRY: preco de entrada sugerido
SL: distancia em pips para stop loss
TP: distancia em pips para take profit`,

  fvg_strategy: `Voce e um analista especializado em Inverse Fair Value Gaps (IFVG) baseado na metodologia LuxAlgo.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Considere IFVG como sinais de REVERSAO:
- Bullish IFVG: preco fecha ABAIXO de um FVG bearish (invalidacao) = sinal de COMPRA
- Bearish IFVG: preco fecha ACIMA de um FVG bullish (invalidacao) = sinal de VENDA
- Quanto maior o FVG original, mais forte o sinal IFVG
- IFVG + sweep de liquidez = entrada de alta confianca
- IFVG + BOS/CHoCH = confirmacao estrutural
- Confluencia multi-timeframe (M5 + M15) aumenta confiabilidade
- Volume alto na invalidacao confirma o IFVG

FVGs originais para contexto:
- BISI (Buy-side Imbalance): gap para cima = suporte
- SIBI (Sell-side Imbalance): gap para baixo = resistencia
- Quando invalidados, viram IFVG = reversao

Escreva uma analise detalhada e natural, mencionando os IFVGs especificos identificados nos dados e por que representam uma oportunidade. Minimo 3 frases.

Responda no formato:
BULLISH ou BEARISH - analise detalhada com fundamentos IFVG
CONFIDENCIA: nivel de confianca (1-10)
ENTRY: preco de entrada sugerido
SL: distancia em pips para stop loss
TP: distancia em pips para take profit`,

  price_action: `Voce e um analista de price action puro, focado em padroes de candles e estrutura de mercado.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Considere: Engulfing, Pin Bar, Doji, Hammer, Morning/Evening Star, Inside Bar, Breakout de Consolidacao, suporte/resistencia. Mentione quais padroes especificos voce identificou nos dados de preco.

Escreva uma analise detalhada e natural, como se estivesse explicando para um aluno. Minimo 3 frases de justificativa.

Responda no formato:
BULLISH ou BEARISH - analise detalhada com fundamentos de price action
CONFIDENCIA: nivel de confianca (1-10)
ENTRY: preco de entrada sugerido
SL: distancia em pips para stop loss
TP: distancia em pips para take profit`,

  custom: `Voce e um analista tecnico profissional de trading.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Use seus conhecimentos de analise tecnica para tomar a melhor decisao. Escreva uma analise detalhada e natural, mencionando observacoes especificas dos dados de preco. Minimo 3 frases de justificativa.

Responda no formato:
BULLISH ou BEARISH - analise detalhada com suas observacoes
CONFIDENCIA: nivel de confianca (1-10)
ENTRY: preco de entrada sugerido
SL: distancia em pips para stop loss
TP: distancia em pips para take profit`,

  mmxm: `Voce e um analista especializado em Market Maker Model (MMXM) da metodologia ICT.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Identifique a fase atual do ciclo de mercado:
1. ACCUMULATION (acumulacao) - lateralizacao smart money comprando
2. MANIPULATION (manipulacao) - fake move para pegar liquidez
3. DISTRIBUTION (distribuicao) - lateralizacao smart money vendendo
4. EXPANSION (expansao) - movimento forte direcional

Considere:
- Market Maker Buy Model (MMBM) vs Market Maker Sell Model (MMSM)
- Institutional Order Flow (IOF)
- Liquidity Sweep (sweep de liquidez/stop hunt)
- Break of Structure (BOS) / Change of Character (CHoCH)
- Premium/Discount zones (acima/abaixo de 50% do range)
- Smart Money trap (armadilha institucional)
- Judas Swing (swing falso para pegar liquidez)
- Silver Bullet / Silver Entry
- Optimal Trade Entry (OTE) - retrace 61.8%-79% Fibonacci
- Power of 3 (accumulation-manipulation-distribution no candle)

Escreva uma analise detalhada e natural, explicando qual fase do MMXM esta ocorrendo e por que. Minimo 3 frases com observacoes dos dados.

Responda no formato:
BULLISH ou BEARISH - analise detalhada com fundamentos MMXM
FASE: accumulation/manipulation/distribution/expansion
CONFIDENCIA: nivel de confianca (1-10)
ENTRY: preco de entrada sugerido
SL: distancia em pips para stop loss
TP: distancia em pips para take profit`,

  crt: `Voce e um analista especializado em Candle Range Theory (CRT) e price action.

Analise os dados de mercado abaixo e classifique a direcao como BULLISH (alta) ou BEARISH (baixa).

Considere Candle Range Theory:
- Range do candle = alta (high) - baixa (low)
- Corpo (body) = movimento real | Sombra (wick) = rejeicao
- Candle anterior define a referencia para o candle atual

Regras CRT:
1. Preco fecha ACIMA do high do candle anterior = BULLISH (expansao)
2. Preco fecha ABAIXO do low do candle anterior = BEARISH (expansao)
3. Preco fica DENTRO do range = INDECISO (aguardar)
4. Wick longa em cima = rejeicao de alta = pressao vendedora
5. Wick longa em baixo = rejeicao de baixa = pressao compradora

Confluencias CRT:
- Range expansion + volume = entrada confiavel
- Inside bar (candle menor que o anterior) = compressao antes da explosao
- Outside bar (candle maior que o anterior) = momentum forte
- Doji no final de tendencia = reversao iminente
- 3 candles na mesma direcao = tendencia confirmada

Escreva uma analise detalhada e natural, explicando os ranges observados e por que indicam a direcao. Minimo 3 frases.

Responda no formato:
BULLISH ou BEARISH - analise detalhada com fundamentos CRT
CONFIDENCIA: nivel de confianca (1-10)
ENTRY: preco de entrada sugerido
SL: distancia em pips para stop loss
TP: distancia em pips para take profit`,
};

export async function getStrategyPrompt(strategy, riskSettings, history, pair, userId) {
  const settings = loadJSON('ai_agent_settings.json', {});
  const langCode = settings.language || 'pt';
  const langName = LANGUAGES[langCode] || LANGUAGES.pt;
  const langInstruction = `\n\nResponda SEMPRE em ${langName}. Todas as descricoes, justificativas e analises devem ser escritas exclusivamente neste idioma.`;

  let prompt;
  if (strategy === 'custom' && settings.defaultPrompt && settings.defaultPrompt.trim()) {
    prompt = settings.defaultPrompt;
  } else {
    prompt = SYSTEM_PROMPTS[strategy] || SYSTEM_PROMPTS.ict_smc;
  }

  const riskCtx = riskSettings ? `Max posicoes: ${riskSettings.max_positions || 5} | Max perda/dia: $${riskSettings.max_loss_per_day || 100}` : 'N/A';
  const historyCtx = history || 'Nenhum';
  prompt = prompt.replace('{risk_settings}', riskCtx).replace('{history}', historyCtx).replace('{pair}', pair || 'N/A');

  const adaptiveAddition = userId ? await generateAdaptivePromptAddition(userId, pair, strategy) : '';

  return prompt + langInstruction + adaptiveAddition;
}

export async function buildTradeMemoryContext(userId, pair) {
  if (!userId || !pair) return '';

  const memory = await getTradeMemory(userId, pair, 10);
  const stats = await getTradeMemoryStats(userId, pair);
  const reasons = await getRecentTradeReasons(userId, pair, 5);

  if (!memory.length && !stats) return '';

  let ctx = `\n\n--- MEMORIA DE TRADES ${pair} ---\n`;

  if (stats) {
    ctx += `Performance historica: ${stats.total} trades | Win Rate: ${stats.winRate}% | Lucro total: $${stats.totalProfit}`;
    ctx += ` | Media ganho: $${stats.avgWin} | Media perda: $${stats.avgLoss} | Profit Factor: ${stats.profitFactor}\n`;
    for (const [type, data] of Object.entries(stats.byType)) {
      ctx += `  ${type}: ${data.count} trades | Win Rate: ${data.count ? ((data.wins / data.count) * 100).toFixed(0) : 0}% | P/L: $${data.profit.toFixed(2)}\n`;
    }
  }

  if (reasons.length > 0) {
    ctx += `Ultimas analises LLM para ${pair}:\n`;
    for (const r of reasons) {
      const result = r.profit > 0 ? 'WIN' : r.profit < 0 ? 'LOSS' : 'OPEN';
      ctx += `  ${r.type} | Resultado: ${result} $${r.profit.toFixed(2)} | Confianca: ${((r.confidence || 0.5) * 100).toFixed(0)}% | Motivo: ${(r.reason || '').slice(0, 100)}\n`;
    }
  }

  if (memory.length > 0) {
    ctx += `Historico recente (fechados):\n`;
    for (const t of memory.slice(0, 5)) {
      const result = t.profit > 0 ? 'WIN' : 'LOSS';
      ctx += `  ${t.type} @ ${t.price} → ${t.exit_price} | ${result} $${t.profit.toFixed(2)} | Fonte: ${t.signal_source || t.source || 'N/A'}\n`;
    }
  }

  ctx += `--- FIM MEMORIA ---\n`;
  ctx += `Aprenda com os patterns: se win rate esta baixo em um tipo de trade, seja mais seletivo. Se um par esta performando bem, considere oportunidades similares.`;

  return ctx;
}

export async function buildTradeAnalysisPrompt(pair, priceData, accountInfo, riskSettings, openPositionsCount = 0, userId) {
  const recent = priceData.slice(-60);
  const closes = recent.map(d => typeof d.close === 'number' ? d.close : (typeof d === 'number' ? d : 0));
  const highs = recent.map(d => typeof d.high === 'number' ? d.high : (typeof d === 'number' ? d : 0));
  const lows = recent.map(d => typeof d.low === 'number' ? d.low : (typeof d === 'number' ? d : 0));
  const decimals = getDecimals(pair);
  const symType = getSymbolType(pair);

  const lastClose = closes[closes.length - 1];
  const firstClose = closes[0];
  const changeRatio = (lastClose - firstClose) / Math.max(firstClose, 0.00001);

  let upCloses = 0;
  let downCloses = 0;
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) upCloses++;
    else downCloses++;
  }

  const hi = Math.max(...highs);
  const lo = Math.min(...lows);

  const riskCtx = `Max posicoes: ${riskSettings?.max_positions || 5} | Max perda/dia: $${riskSettings?.max_loss_per_day || 100} | Posicoes abertas: ${openPositionsCount}`;
  const recentTrades = riskSettings?.recentTrades || 'Nenhum';
  const typeLabel = symType === 'synthetic' ? 'Indice Sintetico' : symType === 'crypto' ? 'Criptomoeda' : 'Forex';

  const tradeMemoryCtx = userId ? await buildTradeMemoryContext(userId, pair) : '';

  return `Considere o contexto de risco: ${riskCtx}
Considere o historico recente: ${recentTrades}

Dados de mercado para ${pair} (${typeLabel}):
Ultimos ${closes.length} candles | Up closes: ${upCloses} | Down closes: ${downCloses}
Primeiro close: ${firstClose.toFixed(decimals)} | Ultimo close: ${lastClose.toFixed(decimals)} | Variacao: ${changeRatio.toFixed(4)}
Maxima: ${hi.toFixed(decimals)} | Minima: ${lo.toFixed(decimals)}${tradeMemoryCtx}`;
}

export function parseLLMResponse(response) {
  if (!response) return { action: 'wait', confidence: 0.5, reason: 'Sem resposta do LLM', raw: '' };

  const text = response.trim();

  const confMatch = text.match(/CONFIDENCIA:\s*(\d+)/i);
  const confidence = confMatch ? Math.min(parseInt(confMatch[1]) / 10, 1.0) : 0.7;

  const entryMatch = text.match(/ENTRY:\s*([\d.]+)/i);
  const slMatch = text.match(/SL:\s*([\d.]+)/i);
  const tpMatch = text.match(/TP:\s*([\d.]+)/i);

  const firstWord = text.split(/\s+/)[0].toLowerCase().replace(/[^a-z]/g, '');
  let action = 'wait';

  if (firstWord === 'bearish' || firstWord === 'bear' || firstWord === 'sell') {
    action = 'sell';
  } else if (firstWord === 'bullish' || firstWord === 'bull' || firstWord === 'buy') {
    action = 'buy';
  }

  let reason = text
    .replace(/^BULLISH\s*/i, '')
    .replace(/^BEARISH\s*/i, '')
    .replace(/^[-–—]\s*/i, '')
    .replace(/CONFIDENCIA:\s*\d+/i, '')
    .replace(/ENTRY:\s*[\d.]+/i, '')
    .replace(/SL:\s*[\d.]+/i, '')
    .replace(/TP:\s*[\d.]+/i, '')
    .replace(/\n/g, ' ')
    .trim();

  if (!reason) reason = response.trim().slice(0, 200);

  return {
    action,
    confidence,
    reason,
    entry_price: entryMatch ? parseFloat(entryMatch[1]) : null,
    stop_loss: slMatch ? parseFloat(slMatch[1]) : null,
    take_profit: tpMatch ? parseFloat(tpMatch[1]) : null,
    raw: response,
  };
}

export function parsePositionManagementResponse(response) {
  if (!response) return { action: 'hold', reason: 'Sem resposta', new_sl: 0, raw: '' };

  const text = response.trim();

  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const validActions = ['hold', 'move_sl_breakeven', 'move_sl_profit', 'partial_close', 'close'];
      return {
        action: validActions.includes(parsed.action) ? parsed.action : 'hold',
        reason: parsed.reason || 'Sem motivo',
        new_sl: parsed.new_sl || 0,
        raw: response,
      };
    } catch {}
  }

  const firstWord = text.split(/\s+/)[0].toLowerCase().replace(/[^a-z_]/g, '');
  const validActions = ['hold', 'move_sl_breakeven', 'move_sl_profit', 'partial_close', 'close'];
  const action = validActions.includes(firstWord) ? firstWord : 'hold';

  return {
    action,
    reason: text.replace(/^[\w_]+\s*[-–—:]\s*/i, '').trim() || 'Analise LLM',
    new_sl: 0,
    raw: response,
  };
}

export function buildPositionManagementPrompt(position, priceData) {
  const direction = position.type === 0 ? 'BUY' : 'SELL';
  const entry = position.price_open;
  const currentPrice = position.price_current;
  const sl = position.stop_loss || 0;
  const tp = position.take_profit || 0;
  const volume = position.volume;
  const profit = position.profit || 0;
  const profitPct = entry > 0 ? ((currentPrice - entry) / entry * 100) : 0;
  const risk = Math.abs(entry - sl);
  const rewardNow = Math.abs(currentPrice - entry);
  const rrAchieved = risk > 0 ? rewardNow / risk : 0;
  const decimals = getDecimals(position.symbol);

  const recent = priceData.slice(-20);
  const closes = recent.map(d => typeof d.close === 'number' ? d.close : (typeof d === 'number' ? d : 0));

  const settings = loadJSON('ai_agent_settings.json', {});
  const langCode = settings.language || 'pt';
  const langName = LANGUAGES[langCode] || LANGUAGES.pt;

  return `RETORNE APENAS JSON, NENHUM TEXTO ANTES OU DEPOIS.

Responda o campo "reason" em ${langName}.

Gerencie esta posicao aberta e retorne:
{"action":"hold|move_sl_breakeven|move_sl_profit|partial_close|close","reason":"motivo em ${langName}","new_sl":0.0}

POSICAO: ${position.symbol} ${direction}
  Entrada: ${entry.toFixed(decimals)} | Volume: ${volume}
  SL atual: ${sl.toFixed(decimals)} | TP atual: ${tp.toFixed(decimals)}
  Preco atual: ${currentPrice.toFixed(decimals)} | Lucro: ${profit.toFixed(2)} (${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%)
  RR alcancado: ${rrAchieved.toFixed(2)}
  Ultimos closes: ${closes.slice(-5).map(p => p.toFixed(decimals)).join(', ')}

REGRAS DE GERENCIAMENTO:
- HOLD: manter se tendencia continua a favor
- MOVE_SL_BREAKEVEN: quando lucro >= 0.5% (proteger entrada)
- MOVE_SL_PROFIT: quando lucro > 1.0% e reversao iminente (trailing)
- PARTIAL_CLOSE: fechar 50% quando lucro > 1.5% e sinal de reversao
- CLOSE: quando reversao detectada ou perda > 2%
- Se RR alcancado >= 2.0, considere MOVE_SL_PROFIT ou PARTIAL_CLOSE
- Se preco voltou para entrada e perca, CLOSE imediatamente
- new_sl: novo nivel de SL (0 se nao aplicavel)`;
}

export async function callLLM(provider, apiKey, model, systemPrompt, userPrompt) {
  if (provider === 'openrouter') {
    const resolvedModel = resolveModelId(model);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'Trading Dashboard',
      },
      body: JSON.stringify({
        model: resolvedModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.2,
      }),
    });
    const data = await response.json();
    if (data.error) {
      throw new Error(`LLM API: ${data.error.message || JSON.stringify(data.error)}`);
    }
    return data.choices?.[0]?.message?.content || '';
  } else if (provider === 'ollama') {
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: systemPrompt + '\n\n' + userPrompt,
        stream: false,
      }),
    });
    const data = await response.json();
    return data.response || '';
  }
  throw new Error('Provider nao suportado');
}

export function addToHistory(entry) {
  const historyPath = join(DATA_DIR, 'llm_analysis_history.json');
  let history = [];
  try { history = JSON.parse(readFileSync(historyPath, 'utf8')); } catch {}
  history.push(entry);
  if (history.length > 500) history.splice(0, history.length - 500);
  writeFileSync(historyPath, JSON.stringify(history, null, 2));
}

export function loadSettings() {
  return loadJSON('ai_agent_settings.json', {});
}
