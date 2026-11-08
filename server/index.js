import { resolve } from 'node:path';
import { createApp } from './app.js';

const port = Number(process.env.PORT || 3000);
const { app, store, monitor, tickDemo } = createApp({ dbPath: resolve(process.env.DB_PATH || 'data/colony-watch.sqlite'), demoMode: process.env.DEMO_MODE !== 'false' });
// This prototype has a local coordinator trust boundary. Never expose it on 0.0.0.0.
const server = app.listen(port, '127.0.0.1', () => console.log(`Colony Watch is ready at http://127.0.0.1:${port}`));
tickDemo();
const timer = setInterval(() => { tickDemo(); monitor(); }, 30000);
function shutdown() { clearInterval(timer); server.close(() => { store.close(); process.exit(0); }); }
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
