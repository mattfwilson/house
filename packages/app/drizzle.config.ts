// drizzle-kit config (RESEARCH A5). dialect sqlite; schema points at the persistence
// schema authored in 06-03+; migrations are emitted to ./drizzle and committed as a
// reproducibility artifact (D-11 — these SQL files are NOT gitignored).
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/adapters/persistence/schema.ts',
  out: './drizzle',
  dbCredentials: {
    url: process.env.DB_FILE_NAME ?? './house.sqlite',
  },
});
