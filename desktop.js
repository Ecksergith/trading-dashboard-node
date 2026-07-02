import { spawn } from 'child_process';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = process.env.PORT || 5001;
const URL = `http://localhost:${PORT}`;

console.log('=================================');
console.log('  Trading Dashboard - Desktop');
console.log('=================================');
console.log('');
console.log('Iniciando servidor...');

const server = spawn('node', ['server/index.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  env: { ...process.env, PORT: String(PORT) },
});

server.on('error', (err) => {
  console.error('Erro ao iniciar servidor:', err.message);
  process.exit(1);
});

let browserOpened = false;

function openBrowser() {
  if (browserOpened) return;
  browserOpened = true;

  setTimeout(() => {
    console.log(`Abrindo navegador em ${URL}...`);
    const platform = process.platform;
    if (platform === 'win32') exec(`start ${URL}`);
    else if (platform === 'darwin') exec(`open ${URL}`);
    else exec(`xdg-open ${URL}`);

    console.log('');
    console.log('Dashboard rodando! Feche este terminal para encerrar.');
  }, 2000);
}

openBrowser();

process.on('SIGINT', () => {
  console.log('\nEncerrando...');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  server.kill();
  process.exit(0);
});
