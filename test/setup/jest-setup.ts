import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test before running tests
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

beforeAll(() => {
  console.log('🧪 E2E Test Suite Starting...');
  console.log(`📁 Using database: ${process.env.DATABASE_URL?.split('@')[1] || 'unknown'}`);
});

afterAll(() => {
  console.log('✅ E2E Test Suite Complete');
});
