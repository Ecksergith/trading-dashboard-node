import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setLoggerState, pushLog, createLogger } from './server/lib/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// ============================================================
console.log('\n🔍 TESTE 1: pushLog() adiciona ao state.logs');
// ============================================================
const state = { logs: [] };
setLoggerState(state);
pushLog('Mensagem de teste');
test('pushLog adiciona 1 entry', state.logs.length === 1);
test('Entry tem time', !!state.logs[0].time);
test('Entry tem level "info"', state.logs[0].level === 'info');
test('Entry tem message correta', state.logs[0].message === 'Mensagem de teste');

// ============================================================
console.log('\n🔍 TESTE 2: pushLog com level customizado');
// ============================================================
pushLog('Erro simulado', 'error');
test('Level "error" registrado', state.logs[1].level === 'error');
test('Mensagem de erro preservada', state.logs[1].message === 'Erro simulado');

// ============================================================
console.log('\n🔍 TESTE 3: createLogger() prefix + msg');
// ============================================================
const log = createLogger('[AutoTrader]');
log('Ordem executada EURUSD');
test('Logger cria entry com prefix', state.logs[2].message.includes('[AutoTrader]'));
test('Logger inclui mensagem', state.logs[2].message.includes('Ordem executada EURUSD'));

// ============================================================
console.log('\n🔍 TESTE 4: createLogger com accountId');
// ============================================================
const multiLog = createLogger('[MultiAutoTrader]');
multiLog('Analise LLM GBPUSD', 'conta-01');
test('Multi-log inclui accountId', state.logs[3].message.includes('[conta-01]'));
test('Multi-log inclui prefix', state.logs[3].message.includes('[MultiAutoTrader]'));

// ============================================================
console.log('\n🔍 TESTE 5: Limite de 1000 logs');
// ============================================================
for (let i = 0; i < 1005; i++) {
  pushLog(`Log ${i}`);
}
test('Max 1000 entries (1005 pushadas)', state.logs.length <= 1000);

// ============================================================
console.log('\n🔍 TESTE 6: Código fonte verifica integração');
// ============================================================
const indexCode = readFileSync(join(__dirname, 'server', 'index.js'), 'utf8');
const autoCode = readFileSync(join(__dirname, 'server', 'lib', 'auto-trader.js'), 'utf8');
const multiCode = readFileSync(join(__dirname, 'server', 'lib', 'multi-account-trader.js'), 'utf8');

test('index.js importa setLoggerState + pushLog', indexCode.includes('setLoggerState') && indexCode.includes('pushLog'));
test('index.js chama setLoggerState(state)', indexCode.includes('setLoggerState(state)'));
test('index.js pushLog no startup', indexCode.includes("pushLog(`Servidor iniciado"));
test('index.js pushLog auto-trader start/stop', indexCode.includes("pushLog('Auto-trader iniciado") && indexCode.includes("pushLog('Auto-trader parado'"));
test('index.js pushLog MT5 status', indexCode.includes("pushLog(mt5Connected ? 'MT5 conectado'"));
test('index.js pushLog erros', indexCode.includes("pushLog(`Unhandled Rejection:"));
test('auto-trader.js importa createLogger', autoCode.includes("from './logger.js'"));
test('auto-trader.js usa createLogger', autoCode.includes('createLogger(LOG_PREFIX)'));
test('multi-account-trader.js importa createLogger', multiCode.includes("from './logger.js'"));
test('multi-account-trader.js usa createLogger', multiCode.includes('createLogger(LOG_PREFIX)'));

// ============================================================
console.log('\n' + '='.repeat(50));
console.log(`📊 RESULTADO: ${passed} passaram, ${failed} falharam de ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ TODOS OS TESTES PASSARAM!\n');
}
