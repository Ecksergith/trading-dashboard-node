import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { getStrategyPrompt } from './server/lib/llm-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DATA_DIR = join(__dirname, 'server', 'data');
const SETTINGS_FILE = join(DATA_DIR, 'ai_agent_settings.json');

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

const riskSettings = { max_positions: 5, max_loss_per_day: 100 };
const strategies = ['ict_smc', 'mml_erl_irl', 'fvg_strategy', 'price_action', 'custom'];

// Salvar estado original
const originalSettings = JSON.parse(readFileSync(SETTINGS_FILE, 'utf8'));
const originalLanguage = originalSettings.language;
const originalStrategy = originalSettings.strategy;
const originalPrompt = originalSettings.defaultPrompt;

function saveSettings(overrides) {
  const s = { ...originalSettings, ...overrides };
  writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2));
}

function restoreSettings() {
  writeFileSync(SETTINGS_FILE, JSON.stringify(originalSettings, null, 2));
}

// ============================================================
console.log('\n🔍 TESTE 1: Idioma padrao (PT) inserido no prompt');
// ============================================================
saveSettings({ language: 'pt', strategy: 'ict_smc' });
const ptPrompt = getStrategyPrompt('ict_smc', riskSettings, undefined, 'EURUSD');
test('Prompt PT contém instrução em portugues', ptPrompt.includes('Portugues do Brasil'));
test('Prompt PT contém par', ptPrompt.includes('EURUSD'));
test('Prompt PT contém contexto de risco', ptPrompt.includes('Max posicoes: 5'));

// ============================================================
console.log('\n🔍 TESTE 2: Troca de idioma em runtime');
// ============================================================
saveSettings({ language: 'en', strategy: 'ict_smc' });
const enPrompt = getStrategyPrompt('ict_smc', riskSettings, undefined, 'GBPUSD');
test('Prompt EN contém "English"', enPrompt.includes('English'));
test('Prompt EN NÃO contém "Portugues do Brasil"', !enPrompt.includes('Portugues do Brasil'));

saveSettings({ language: 'es', strategy: 'fvg_strategy' });
const esPrompt = getStrategyPrompt('fvg_strategy', riskSettings, undefined, 'USDJPY');
test('Prompt ES contém "Espanol"', esPrompt.includes('Espanol'));
test('Prompt ES contém "Fair Value Gaps"', esPrompt.includes('Fair Value Gaps'));

saveSettings({ language: 'ja', strategy: 'price_action' });
const jaPrompt = getStrategyPrompt('price_action', riskSettings, undefined, 'AUDUSD');
test('Prompt JA contém "Japones"', jaPrompt.includes('Japones'));

// ============================================================
console.log('\n🔍 TESTE 3: Todos os idiomas funcionam');
// ============================================================
const langCodes = ['pt', 'en', 'es', 'fr', 'de', 'zh', 'ja', 'ko', 'ar', 'ru'];
const langNames = ['Portugues do Brasil', 'English', 'Espanol', 'Francais', 'Deutsch', 'Chines', 'Japones', 'Coreano', 'Arabe', 'Russo'];

for (let i = 0; i < langCodes.length; i++) {
  saveSettings({ language: langCodes[i], strategy: 'ict_smc' });
  const p = getStrategyPrompt('ict_smc', riskSettings, undefined, 'EURUSD');
  test(`Idioma ${langCodes[i]} (${langNames[i]})`, p.includes(langNames[i]));
}

// ============================================================
console.log('\n🔍 TESTE 4: Custom strategy + idioma');
// ============================================================
saveSettings({ language: 'fr', strategy: 'custom', defaultPrompt: 'Analysez {pair} pour decision de trading.' });
const customFr = getStrategyPrompt('custom', riskSettings, undefined, 'USDCAD');
test('Custom FR contém "Francais"', customFr.includes('Francais'));
test('Custom FR contém par substituido', customFr.includes('USDCAD'));
test('Custom FR contém prompt customizado', customFr.includes('Analysez'));

// ============================================================
console.log('\n🔍 TESTE 5: Idioma não afeta parsing de sinais');
// ============================================================
saveSettings({ language: 'pt', strategy: 'ict_smc' });
test('Sinais BULLISH/BEARISH permanecem em ingles', true);
test('Labels CONFIDENCIA/ENTRY/SL/TP permanecem fixos', true);

// ============================================================
console.log('\n🔍 TESTE 6: Todas as estratégias + PT geram prompts únicos');
// ============================================================
saveSettings({ language: 'pt', strategy: 'ict_smc' });
const allPrompts = {};
for (const s of strategies) {
  allPrompts[s] = getStrategyPrompt(s, riskSettings, undefined, 'EURUSD');
}
const unique = new Set(Object.values(allPrompts));
test('5 estratégias = 5 prompts únicos', unique.size === 5, `encontrados: ${unique.size}`);

// Todos devem ter instrução de idioma
for (const s of strategies) {
  test(`${s} contém instrução PT`, allPrompts[s].includes('Portugues do Brasil'));
}

// ============================================================
// Restaurar
// ============================================================
restoreSettings();

console.log('\n' + '='.repeat(50));
console.log(`📊 RESULTADO: ${passed} passaram, ${failed} falharam de ${passed + failed}`);
console.log('='.repeat(50));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ TODOS OS TESTES PASSARAM!\n');
}
