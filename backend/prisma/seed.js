/**
 * Seed script: creates the first admin user and default global settings.
 * Usage: npm run seed --workspace backend  (requires DATABASE_URL)
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_SETTINGS = [
  { key: 'system_prompt', value: '' },
  { key: 'show_sources', value: true },
  { key: 'fact_check', value: false },
  { key: 'maintenance_mode', value: false },
  { key: 'blocked_domains', value: [] },
  { key: 'deep_research_max_searches', value: 6 },
  { key: 'chat_rate_limit_max', value: 20 },
  { key: 'allow_registration', value: true },
];

async function main () {
  const email = (process.env.ADMIN_EMAIL || 'admin@novaai.local').toLowerCase();
  const password = process.env.ADMIN_PASSWORD || 'ChangeMe123!';

  const existing = await prisma.user.findUnique({ where: { email } });
  let user = existing;
  if (!existing) {
    user = await prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 12),
        name: 'NovaAI Admin',
        role: 'ADMIN',
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Created admin user: ${email}`);
  } else if (existing.role !== 'ADMIN') {
    user = await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
    console.log(`Promoted existing user to ADMIN: ${email}`);
  } else {
    console.log(`Admin user already exists: ${email}`);
  }

  for (const setting of DEFAULT_SETTINGS) {
    // eslint-disable-next-line no-await-in-loop
    await prisma.setting.upsert({
      where: { key_userId_scope: { key: setting.key, userId: null, scope: 'GLOBAL' } },
      create: { key: setting.key, scope: 'GLOBAL', userId: null, value: setting.value },
      update: {},
    });
  }
  console.log(`Seeded ${DEFAULT_SETTINGS.length} global settings.`);
  console.log('Done.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
