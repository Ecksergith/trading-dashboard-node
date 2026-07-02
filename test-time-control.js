import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const OrigDate = globalThis.Date;

let passed = 0;
let failed = 0;

function test(name, condition, detail) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}${detail ? ' — ' + detail : ''}`);
    failed++;
  }
}

function isTradingAllowed(riskSettings) {
  if (!riskSettings.auto_trading) return false;
  if (riskSettings.time_control_enabled) {
    const now = new Date();
    const dayNames = ['Domingo', 'Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta', 'Sabado'];
    const dayName = dayNames[now.getDay()];
    if (riskSettings.trading_days && !riskSettings.trading_days[dayName]) return false;
    const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    if (riskSettings.start_time && riskSettings.end_time) {
      if (currentTime < riskSettings.start_time || currentTime > riskSettings.end_time) return false;
    }
  }
  return true;
}

function mockDate(dayName, hour, minute) {
  const dayMap = { Domingo: 0, Segunda: 1, Terca: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sabado: 6 };
  const fakeNow = new OrigDate(2026, 5, dayMap[dayName], hour, minute, 0);
  globalThis.Date = function (...args) {
    if (args.length === 0) return fakeNow;
    return new OrigDate(...args);
  };
  globalThis.Date.now = () => fakeNow.getTime();
  globalThis.Date.parse = OrigDate.parse;
  globalThis.Date.UTC = OrigDate.UTC;
}

function restoreDate() {
  globalThis.Date = OrigDate;
}

const baseSettings = {
  auto_trading: true,
  time_control_enabled: true,
  start_time: '14:30',
  end_time: '22:30',
  trading_days: { Segunda: true, Terca: true, Quarta: true, Quinta: true, Sexta: true, Sabado: false, Domingo: false },
};

// ============================================================
console.log('\n🔍 TESTE 1: auto_trading desligado → sempre bloqueado');
// ============================================================
test('auto_trading=false bloqueia', isTradingAllowed({ ...baseSettings, auto_trading: false }) === false);
test('auto_trading=true permite', isTradingAllowed({ ...baseSettings }) === true);

// ============================================================
console.log('\n🔍 TESTE 2: time_control_enabled desligado → ignora horário');
// ============================================================
mockDate('Domingo', 3, 0);
test('time_control=false + Domingo 03:00 permite', isTradingAllowed({ ...baseSettings, time_control_enabled: false }) === true);
restoreDate();

// ============================================================
console.log('\n🔍 TESTE 3: Dias da semana');
// ============================================================
const diasPermitidos = ['Segunda', 'Terca', 'Quarta', 'Quinta', 'Sexta'];
const diasBloqueados = ['Sabado', 'Domingo'];

for (const dia of [...diasPermitidos, ...diasBloqueados]) {
  mockDate(dia, 16, 0);
  const resultado = isTradingAllowed({ ...baseSettings });
  const esperado = diasPermitidos.includes(dia);
  test(`${dia} 16:00 → ${esperado ? 'PERMITE' : 'BLOQUEIA'}`, resultado === esperado);
  restoreDate();
}

// ============================================================
console.log('\n🔍 TESTE 4: Faixa de horário — DENTRO');
// ============================================================
const horariosDentro = [
  ['Segunda', 14, 30], ['Segunda', 15, 0], ['Segunda', 18, 45],
  ['Segunda', 22, 30], ['Quarta', 20, 0], ['Sexta', 14, 30],
];

for (const [dia, h, m] of horariosDentro) {
  mockDate(dia, h, m);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  test(`${dia} ${hh}:${mm} (dentro) → PERMITE`, isTradingAllowed({ ...baseSettings }) === true);
  restoreDate();
}

// ============================================================
console.log('\n🔍 TESTE 5: Faixa de horário — FORA');
// ============================================================
const horariosFora = [
  ['Segunda', 14, 29], ['Segunda', 22, 31], ['Segunda', 0, 0],
  ['Segunda', 8, 0], ['Segunda', 23, 59], ['Quarta', 10, 0],
];

for (const [dia, h, m] of horariosFora) {
  mockDate(dia, h, m);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  test(`${dia} ${hh}:${mm} (fora) → BLOQUEIA`, isTradingAllowed({ ...baseSettings }) === false);
  restoreDate();
}

// ============================================================
console.log('\n🔍 TESTE 6: Dias todos desligados → bloqueia tudo');
// ============================================================
mockDate('Quarta', 16, 0);
const noDays = {
  ...baseSettings,
  trading_days: { Segunda: false, Terca: false, Quarta: false, Quinta: false, Sexta: false, Sabado: false, Domingo: false },
};
test('Todos dias desligados + Quarta 16:00 → BLOQUEIA', isTradingAllowed(noDays) === false);
restoreDate();

// ============================================================
console.log('\n🔍 TESTE 7: Todos dias ligados inclui Sabado');
// ============================================================
mockDate('Sabado', 16, 0);
const allDays = {
  ...baseSettings,
  trading_days: { Segunda: true, Terca: true, Quarta: true, Quinta: true, Sexta: true, Sabado: true, Domingo: true },
};
test('Sabado ligado 16:00 → PERMITE', isTradingAllowed(allDays) === true);
restoreDate();

// ============================================================
console.log('\n🔍 TESTE 8: Horário invertido (start > end)');
// ============================================================
mockDate('Quarta', 16, 0);
test('22:00-08:00 invertido, 16:00 → BLOQUEIA', isTradingAllowed({ ...baseSettings, start_time: '22:00', end_time: '08:00' }) === false);
restoreDate();

// ============================================================
console.log('\n🔍 TESTE 9: Boundaries exatos');
// ============================================================
mockDate('Segunda', 14, 30);
test('start=14:30, agora=14:30 → PERMITE (exato)', isTradingAllowed({ ...baseSettings }) === true);
restoreDate();

mockDate('Segunda', 22, 30);
test('end=22:30, agora=22:30 → PERMITE (exato)', isTradingAllowed({ ...baseSettings }) === true);
restoreDate();

mockDate('Segunda', 22, 31);
test('end=22:30, agora=22:31 → BLOQUEIA (+1min)', isTradingAllowed({ ...baseSettings }) === false);
restoreDate();

mockDate('Segunda', 14, 29);
test('start=14:30, agora=14:29 → BLOQUEIA (-1min)', isTradingAllowed({ ...baseSettings }) === false);
restoreDate();

// ============================================================
console.log('\n🔍 TESTE 10: Código fonte — chamadas isTradingAllowed');
// ============================================================
const autoTrader = readFileSync(join(__dirname, 'server', 'lib', 'auto-trader.js'), 'utf8');
const multiTrader = readFileSync(join(__dirname, 'server', 'lib', 'multi-account-trader.js'), 'utf8');
const aiRoutes = readFileSync(join(__dirname, 'server', 'lib', 'ai-routes.js'), 'utf8');

test('auto-trader.js: chama isTradingAllowed(state.riskSettings)',
  /isTradingAllowed\(state\.riskSettings\)/.test(autoTrader));

test('multi-account-trader.js: chama isTradingAllowed(riskSettings) no intervalo',
  /if \(!isTradingAllowed\(riskSettings\)\) continue;/.test(multiTrader));

test('ai-routes.js: verifica time_control_enabled no runAnalysis',
  aiRoutes.includes('time_control_enabled') && aiRoutes.includes('trading_days') && aiRoutes.includes('start_time'));

test('auto-trader.js: cascade completo (LLM > AI > TI > Memory)',
  ["'LLM'", "'AI Agent'", "'Technical Indicators'", "'Trading Memory'"].every(s => autoTrader.includes(s)));

test('multi-account-trader.js: cascade completo com LLM',
  ["'LLM'", "'AI Agent'", "'Technical Indicators'", "'Trading Memory'"].every(s => multiTrader.includes(s)));

// ============================================================
console.log('\n' + '='.repeat(50));
console.log(`📊 RESULTADO: ${passed} passaram, ${failed} falharam de ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ TODOS OS TESTES PASSARAM!\n');
}
