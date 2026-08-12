import { createApp } from './app.js';
import { config } from './config.js';
import { closeInfrastructure, connectInfrastructure } from './infrastructure.js';

async function start(): Promise<void> {
  await connectInfrastructure();

  const app = createApp();
  const server = app.listen(config.port, '0.0.0.0', () => {
    console.log(`ImageWord API listening on port ${config.port}`);
  });

  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`Received ${signal}; shutting down.`);

    server.close(async () => {
      await closeInfrastructure();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

start().catch((error: unknown) => {
  console.error('Backend failed to start', error);
  process.exit(1);
});
