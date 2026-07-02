import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getClosedTrades, getTradeMemoryStats, getUserState, updateUserState } from './db.js';
import { createLogger, pushLog } from './logger.js';
import { patternDB } from './pattern-db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, '..', 'data');
const LEARNING_FILE = join(DATA_DIR, 'llm_learning.json');
const STRATEGY_PERF_FILE = join(DATA_DIR, 'strategy_performance.json');

const LOG_PREFIX = '[LLM-SelfImprove]';
const log = createLogger(LOG_PREFIX);

const DEFAULT_LEARNING = {
  totalAnalyses: 0,
  correctPredictions: 0,
  adaptiveThreshold: 0.6,
  minThreshold: 0.3,
  maxThreshold: 0.85,
  thresholdHistory: [],
  pairStrategies: {},
  commonMistakes: [],
  lastImprovement: null,
  improvementCount: 0,
  learningNotes: [],
};

function loadLearning() {
  try {
    if (existsSync(LEARNING_FILE)) {
      return { ...DEFAULT_LEARNING, ...JSON.parse(readFileSync(LEARNING_FILE, 'utf8')) };
    }
  } catch {}
  return { ...DEFAULT_LEARNING };
}

function saveLearning(data) {
  writeFileSync(LEARNING_FILE, JSON.stringify(data, null, 2));
}

function loadStrategyPerformance() {
  try {
    if (existsSync(STRATEGY_PERF_FILE)) {
      return JSON.parse(readFileSync(STRATEGY_PERF_FILE, 'utf8'));
    }
  } catch {}
  return {};
}

function saveStrategyPerformance(data) {
  writeFileSync(STRATEGY_PERF_FILE, JSON.stringify(data, null, 2));
}

export function getAdaptiveThreshold(userId) {
  const learning = loadLearning();
  return learning.adaptiveThreshold;
}

export function getLearningStats() {
  return loadLearning();
}

export function getStrategyPerformance() {
  return loadStrategyPerformance();
}

export function getBestStrategyForPair(pair) {
  const perf = loadStrategyPerformance();
  const pairData = perf[pair];
  if (!pairData || Object.keys(pairData).length === 0) return null;

  let bestStrategy = null;
  let bestScore = -Infinity;

  for (const [strategy, stats] of Object.entries(pairData)) {
    if (stats.total < 3) continue;
    const winRate = stats.wins / stats.total;
    const profitFactor = stats.totalProfit > 0 && stats.totalLoss < 0
      ? Math.abs(stats.totalProfit / stats.totalLoss)
      : stats.totalProfit > 0 ? 2 : 0;
    const score = winRate * 0.6 + Math.min(profitFactor, 3) / 3 * 0.4;
    if (score > bestScore) {
      bestScore = score;
      bestStrategy = strategy;
    }
  }
  return bestStrategy;
}

export function recordAnalysisOutcome(pair, strategy, action, confidence, wasCorrect, profit) {
  const learning = loadLearning();
  learning.totalAnalyses++;
  if (wasCorrect) learning.correctPredictions++;

  if (!learning.pairStrategies[pair]) learning.pairStrategies[pair] = {};
  if (!learning.pairStrategies[pair][strategy]) {
    learning.pairStrategies[pair][strategy] = { total: 0, wins: 0, losses: 0, totalProfit: 0 };
  }
  const ps = learning.pairStrategies[pair][strategy];
  ps.total++;
  if (wasCorrect) ps.wins++;
  else ps.losses++;
  ps.totalProfit += profit || 0;

  if (!wasCorrect && profit < 0) {
    const mistake = {
      pair,
      strategy,
      action,
      confidence,
      profit,
      time: Date.now(),
      reason: profit < -5 ? 'large_loss' : 'small_loss',
    };
    learning.commonMistakes.push(mistake);
    if (learning.commonMistakes.length > 100) {
      learning.commonMistakes = learning.commonMistakes.slice(-100);
    }
  }

  learning.lastImprovement = Date.now();
  learning.improvementCount++;
  saveLearning(learning);

  const perf = loadStrategyPerformance();
  if (!perf[pair]) perf[pair] = {};
  if (!perf[pair][strategy]) {
    perf[pair][strategy] = { total: 0, wins: 0, totalProfit: 0, totalLoss: 0, avgConfidence: 0 };
  }
  const sp = perf[pair][strategy];
  sp.total++;
  if (profit > 0) { sp.wins++; sp.totalProfit += profit; }
  else { sp.totalLoss += profit; }
  sp.avgConfidence = ((sp.avgConfidence * (sp.total - 1)) + confidence) / sp.total;
  saveStrategyPerformance(perf);

  adjustAdaptiveThreshold(learning);
  saveLearning(learning);
}

function adjustAdaptiveThreshold(learning) {
  if (learning.totalAnalyses < 10) return;

  const recentWindow = Math.min(learning.totalAnalyses, 50);
  const accuracy = learning.correctPredictions / learning.totalAnalyses;

  if (accuracy < 0.4) {
    learning.adaptiveThreshold = Math.min(learning.adaptiveThreshold + 0.05, learning.maxThreshold);
  } else if (accuracy > 0.7) {
    learning.adaptiveThreshold = Math.max(learning.adaptiveThreshold - 0.02, learning.minThreshold);
  } else if (accuracy > 0.6) {
    learning.adaptiveThreshold = Math.max(learning.adaptiveThreshold - 0.01, learning.minThreshold);
  }

  learning.thresholdHistory.push({
    time: Date.now(),
    threshold: learning.adaptiveThreshold,
    accuracy: parseFloat((accuracy * 100).toFixed(1)),
    totalAnalyses: learning.totalAnalyses,
  });
  if (learning.thresholdHistory.length > 200) {
    learning.thresholdHistory = learning.thresholdHistory.slice(-200);
  }
}

export async function analyzeClosedTrades(userId) {
  const trades = await getClosedTrades(userId, 500);
  if (trades.length === 0) return { analyzed: 0, insights: [] };

  const insights = [];
  const byPair = {};
  const byStrategy = {};
  const byConfidence = { high: { wins: 0, losses: 0 }, medium: { wins: 0, losses: 0 }, low: { wins: 0, losses: 0 } };

  for (const trade of trades) {
    const pair = trade.symbol;
    const strategy = trade.source || 'unknown';
    const profit = trade.profit || 0;
    const confidence = trade.confidence || 0.5;

    if (!byPair[pair]) byPair[pair] = { wins: 0, losses: 0, totalProfit: 0, count: 0 };
    byPair[pair].count++;
    byPair[pair].totalProfit += profit;
    if (profit > 0) byPair[pair].wins++;
    else byPair[pair].losses++;

    if (!byStrategy[strategy]) byStrategy[strategy] = { wins: 0, losses: 0, totalProfit: 0, count: 0 };
    byStrategy[strategy].count++;
    byStrategy[strategy].totalProfit += profit;
    if (profit > 0) byStrategy[strategy].wins++;
    else byStrategy[strategy].losses++;

    const confLevel = confidence >= 0.7 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
    if (profit > 0) byConfidence[confLevel].wins++;
    else byConfidence[confLevel].losses++;
  }

  for (const [pair, data] of Object.entries(byPair)) {
    if (data.count < 3) continue;
    const winRate = data.wins / data.count;
    if (winRate < 0.35) {
      insights.push({
        type: 'weak_pair',
        pair,
        winRate: parseFloat((winRate * 100).toFixed(1)),
        totalProfit: parseFloat(data.totalProfit.toFixed(2)),
        recommendation: `Win rate baixo (${(winRate * 100).toFixed(0)}%) no par ${pair}. Considere reduzir exposicao ou mudar estrategia.`,
      });
    } else if (winRate > 0.65) {
      insights.push({
        type: 'strong_pair',
        pair,
        winRate: parseFloat((winRate * 100).toFixed(1)),
        totalProfit: parseFloat(data.totalProfit.toFixed(2)),
        recommendation: `Par ${pair} performando bem (${(winRate * 100).toFixed(0)}% win rate). Considere aumentar exposicao.`,
      });
    }
  }

  const learning = loadLearning();
  const mistakes = learning.commonMistakes;
  const recentMistakes = mistakes.filter(m => Date.now() - m.time < 7 * 24 * 60 * 60 * 1000);
  const mistakePatterns = {};
  for (const m of recentMistakes) {
    const key = `${m.pair}_${m.action}`;
    if (!mistakePatterns[key]) mistakePatterns[key] = { count: 0, totalLoss: 0 };
    mistakePatterns[key].count++;
    mistakePatterns[key].totalLoss += m.profit;
  }

  for (const [key, data] of Object.entries(mistakePatterns)) {
    if (data.count >= 3) {
      const [pair, action] = key.split('_');
      insights.push({
        type: 'repeated_mistake',
        pair,
        action,
        count: data.count,
        totalLoss: parseFloat(data.totalLoss.toFixed(2)),
        recommendation: `${data.count} trades ${action.toUpperCase()} em ${pair} deram prejuizo nos ultimos 7 dias. Considere evitar este tipo de sinal neste par.`,
      });
    }
  }

  const confAccuracies = {};
  for (const [level, data] of Object.entries(byConfidence)) {
    const total = data.wins + data.losses;
    if (total > 0) {
      confAccuracies[level] = parseFloat((data.wins / total * 100).toFixed(1));
    }
  }
  insights.push({
    type: 'confidence_accuracy',
    data: confAccuracies,
    recommendation: `Acuracia por nivel de confianca: Alto ${confAccuracies.high || 0}% | Medio ${confAccuracies.medium || 0}% | Baixo ${confAccuracies.low || 0}%`,
  });

  return {
    analyzed: trades.length,
    insights,
    byPair,
    byStrategy,
    byConfidence,
  };
}

export async function generateAdaptivePromptAddition(userId, pair, strategy) {
  const learning = loadLearning();
  const perf = loadStrategyPerformance();
  let additions = [];

  const pairStrategy = learning.pairStrategies?.[pair]?.[strategy];
  if (pairStrategy && pairStrategy.total >= 5) {
    const winRate = pairStrategy.wins / pairStrategy.total;
    if (winRate < 0.3) {
      additions.push(`AVISO: A estrategia ${strategy} tem win rate de apenas ${(winRate * 100).toFixed(0)}% para ${pair}. Seja EXTREMAMENTE seletivo.`);
    } else if (winRate > 0.65) {
      additions.push(`NOTA: A estrategia ${strategy} performa bem em ${pair} (${(winRate * 100).toFixed(0)}% win rate). Continue com este approach.`);
    }
  }

  const recentMistakes = learning.commonMistakes.filter(m =>
    m.pair === pair && Date.now() - m.time < 3 * 24 * 60 * 60 * 1000
  );
  if (recentMistakes.length >= 2) {
    const wrongDirection = recentMistakes.filter(m => m.action === 'buy').length;
    const wrongDirection2 = recentMistakes.filter(m => m.action === 'sell').length;
    if (wrongDirection >= 2) {
      additions.push(`CUIDADO: Voce errou ${wrongDirection} compras recentes em ${pair}. Considere mais evidencias antes de comprar.`);
    }
    if (wrongDirection2 >= 2) {
      additions.push(`CUIDADO: Voce errou ${wrongDirection2} vendas recentes em ${pair}. Considere mais evidencias antes de vender.`);
    }
  }

  const stats = await getTradeMemoryStats(userId, pair);
  if (stats && stats.total >= 10) {
    if (stats.winRate < 40) {
      additions.push(`Performance historica FRACA em ${pair}: ${stats.winRate}% win rate em ${stats.total} trades. Reduza tamanho das posicoes.`);
    } else if (stats.winRate > 60) {
      additions.push(`Performance HISTORICA positiva em ${pair}: ${stats.winRate}% win rate. Mantenha o approach atual.`);
    }
    if (stats.profitFactor < 1) {
      additions.push(`Profit Factor negativo (${stats.profitFactor}) em ${pair}. O sistema esta perdendo mais do que ganhando.`);
    }
  }

  if (learning.adaptiveThreshold > 0.7) {
    additions.push(`Threshold adaptativo elevado (${(learning.adaptiveThreshold * 100).toFixed(0)}%). Apenas sinais de MUITA confianca devem ser executados.`);
  }

  const patternStats = patternDB.getStats();
  if (patternStats.activePatterns > 0) {
    if (patternStats.avgWinRate > 55) {
      additions.push(`Padroes quantitativos: ${patternStats.activePatterns} padroes ativos com win rate medio de ${patternStats.avgWinRate}% e Sharpe medio de ${patternStats.avgSharpe}.`);
    } else if (patternStats.avgWinRate < 45) {
      additions.push(`ALERTA: Padroes quantitativos com win rate baixo (${patternStats.avgWinRate}%). Reduza exposicao e seja mais seletivo.`);
    }
    const pairPatterns = patternDB.getByPair(pair);
    if (pairPatterns.length > 0) {
      const bestP = pairPatterns[0];
      if (bestP.sharpe > 1 && bestP.pairWinRate > 60) {
        additions.push(`Padrao detectado para ${pair}: Win rate ${bestP.pairWinRate}% (Sharpe ${bestP.sharpe}, ${bestP.occurrences} ocorrencias). Considere seguir o sinal.`);
      }
    }
  }

  if (additions.length === 0) return '';
  return '\n\n--- APRENDIZADO AUTOMATICO ---\n' + additions.join('\n') + '\n--- FIM APRENDIZADO ---';
}

export async function generateWeeklyReport(userId) {
  const trades = await getClosedTrades(userId, 500);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekTrades = trades.filter(t => {
    try { return new Date(t.time).getTime() >= weekAgo; } catch { return false; }
  });

  if (weekTrades.length === 0) return null;

  const wins = weekTrades.filter(t => t.profit > 0);
  const losses = weekTrades.filter(t => t.profit <= 0);
  const totalProfit = weekTrades.reduce((s, t) => s + (t.profit || 0), 0);
  const avgWin = wins.length ? wins.reduce((s, t) => s + t.profit, 0) / wins.length : 0;
  const avgLoss = losses.length ? losses.reduce((s, t) => s + t.profit, 0) / losses.length : 0;

  const bySource = {};
  for (const t of weekTrades) {
    const src = t.signal_source || t.source || 'unknown';
    if (!bySource[src]) bySource[src] = { count: 0, wins: 0, profit: 0 };
    bySource[src].count++;
    if (t.profit > 0) bySource[src].wins++;
    bySource[src].profit += t.profit || 0;
  }

  return {
    period: 'Ultimos 7 dias',
    totalTrades: weekTrades.length,
    wins: wins.length,
    losses: losses.length,
    winRate: parseFloat((wins.length / weekTrades.length * 100).toFixed(1)),
    totalProfit: parseFloat(totalProfit.toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(2)),
    avgLoss: parseFloat(avgLoss.toFixed(2)),
    profitFactor: avgLoss !== 0 ? parseFloat(Math.abs(avgWin / avgLoss).toFixed(2)) : 0,
    bySource,
    adaptiveThreshold: loadLearning().adaptiveThreshold,
  };
}
