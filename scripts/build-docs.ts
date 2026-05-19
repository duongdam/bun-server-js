import { app } from '../src/app';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { logger } from '../src/shared/infrastructure/logger/pino.logger';

async function main() {
  const response = await app.handle(new Request('http://localhost/swagger/json'));
  if (response.status !== 200) {
    console.error('Failed to get OpenAPI spec', await response.text());
    process.exit(1);
  }
  const json = await response.json();
  const docsPath = join(process.cwd(), 'docs', 'openapi.json');
  await fs.writeFile(docsPath, JSON.stringify(json, null, 2));
  logger.info({ docsPath }, 'OpenAPI spec written to');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
