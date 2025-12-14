import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test before running tests
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

beforeAll(() => {
  if (process.env.E2E_TESTS !== 'true') {
    const red = (text: string) => `\x1b[31m${text}\x1b[0m`;
    console.log(red('🚨 FATAL ERROR: E2E tests require E2E_TESTS to be "true".'));
    console.log(red(`Current E2E_TESTS value: "${process.env.E2E_TESTS || 'undefined'}".`));
    console.log(red('Please ensure E2E_TESTS=true is set in your .env.test file or environment variables.'));
    console.log(red('Tests aborted.'));
    process.exit(1);
  }

  console.log('🧪 E2E Test Suite Starting...');
  console.log(`📁 Using database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);
});

afterAll(() => {
  console.log('✅ E2E Test Suite Complete');
});
