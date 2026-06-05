import { createApp } from './app';
import { env } from './config';
import { assertProductionSecretsOrExit } from './lib/production-secrets';

async function start() {
  assertProductionSecretsOrExit();
  const { app, authService } = createApp();
  await authService.ensureDefaultRootAdmin().catch((err) => {
    console.error('Seed default admin failed', err);
  });
  app.listen(env.PORT, env.HOST, () => {
    console.log(
      `Smart CTO backend listening on http://${env.HOST === '0.0.0.0' ? '0.0.0.0 (all interfaces)' : env.HOST}:${env.PORT}`,
    );
    if (env.HOST === '0.0.0.0') {
      console.log('LAN: others can open http://<your-ip>:' + env.PORT + '/api-docs (use http, not https)');
    }
  });
}

start();
