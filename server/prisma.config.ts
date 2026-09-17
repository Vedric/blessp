import 'dotenv/config';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  seed: {
    command: process.env.NODE_ENV === 'production' ? 'node prisma/seed.js' : 'tsx prisma/seed.ts',
  },
});
