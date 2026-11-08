const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'apps', 'api', 'src', 'main.ts');
let content = fs.readFileSync(file, 'utf8');

// Replace process handlers with graceful shutdown coordinator
const targetProcessHandlers = `// Unhandled async rejections otherwise kill the process silently in
// production with a default Node abort (exit code 1, no NestJS stack).
process.on('unhandledRejection', (reason) => {
  processLogger.error(
    \`Unhandled promise rejection: \${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}\`,
  );
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  processLogger.error(\`Uncaught exception: \${error.stack ?? error.message}\`);
  process.exit(1);
});`;

const replacementProcessHandlers = `import type { INestApplication } from '@nestjs/common';

let appInstance: INestApplication | undefined;
let isShuttingDown = false;

async function gracefulShutdown(signalOrReason: string, exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  processLogger.warn(\`Initiating graceful shutdown (reason: \${signalOrReason})...\`);

  const forceExitTimeout = setTimeout(() => {
    processLogger.error('Graceful shutdown timed out after 10s, forcing exit.');
    process.exit(1);
  }, 10000);
  forceExitTimeout.unref();

  try {
    if (appInstance) {
      await appInstance.close();
      processLogger.log('Application connections drained and closed cleanly.');
    }
  } catch (err) {
    processLogger.error(\`Error during graceful shutdown: \${err instanceof Error ? err.message : String(err)}\`);
  } finally {
    process.exit(exitCode);
  }
}

process.on('unhandledRejection', (reason) => {
  processLogger.error(
    \`Unhandled promise rejection: \${reason instanceof Error ? (reason.stack ?? reason.message) : String(reason)}\`,
  );
  if (process.env.NODE_ENV === 'production') {
    void gracefulShutdown('unhandledRejection', 1);
  }
});

process.on('uncaughtException', (error) => {
  processLogger.error(\`Uncaught exception: \${error.stack ?? error.message}\`);
  void gracefulShutdown('uncaughtException', 1);
});

process.on('SIGTERM', () => {
  void gracefulShutdown('SIGTERM', 0);
});

process.on('SIGINT', () => {
  void gracefulShutdown('SIGINT', 0);
});`;

if (content.includes(targetProcessHandlers)) {
  content = content.replace(targetProcessHandlers, replacementProcessHandlers);
}

// Assign appInstance after app creation
const targetAppCreation = `  const app = await NestFactory.create(AppModule, { 
    bodyParser: false,
    logger: isProd ? new JsonLogger() : ['log', 'error', 'warn', 'debug', 'verbose'],
  });`;

const replacementAppCreation = `  const app = await NestFactory.create(AppModule, { 
    bodyParser: false,
    logger: isProd ? new JsonLogger() : ['log', 'error', 'warn', 'debug', 'verbose'],
  });
  appInstance = app;`;

if (content.includes(targetAppCreation)) {
  content = content.replace(targetAppCreation, replacementAppCreation);
}

fs.writeFileSync(file, content, 'utf8');
console.log('Successfully updated main.ts with graceful shutdown and signal handlers');
