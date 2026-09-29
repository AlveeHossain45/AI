/**
 * User repository (PostgreSQL via Prisma, or in-memory in dev mode).
 */
import { getPrisma, isPostgres, memory } from '../db/index.js';

const sanitize = (user) => {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
};

export const userRepo = {
  findByEmail: async (email) => {
    if (isPostgres()) return getPrisma().user.findUnique({ where: { email: email.toLowerCase() } });
    return memory.users.find((row) => row.email === email.toLowerCase()) || null;
  },

  findById: async (id) => {
    if (isPostgres()) return getPrisma().user.findUnique({ where: { id } });
    return memory.users.get(id);
  },

  findByGoogleId: async (googleId) => {
    if (isPostgres()) return getPrisma().user.findUnique({ where: { googleId } });
    return memory.users.find((row) => row.googleId === googleId) || null;
  },

  create: async (data) => {
    const payload = { ...data, email: data.email.toLowerCase() };
    if (isPostgres()) return getPrisma().user.create({ data: payload });
    return memory.users.insert({ isSuspended: false, role: 'USER', ...payload });
  },

  update: async (id, patch) => {
    if (isPostgres()) return getPrisma().user.update({ where: { id }, data: patch });
    return memory.users.update(id, patch);
  },

  publicView: sanitize,

  list: async ({ skip = 0, take = 20, search = '' } = {}) => {
    if (isPostgres()) {
      const where = search
        ? { OR: [{ email: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }] }
        : {};
      const [rows, total] = await Promise.all([
        getPrisma().user.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
        getPrisma().user.count({ where }),
      ]);
      return { rows: rows.map(sanitize), total };
    }
    let rows = memory.users.all();
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((row) => row.email.includes(needle) || (row.name || '').toLowerCase().includes(needle));
    }
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { rows: rows.slice(skip, skip + take).map(sanitize), total: rows.length };
  },

  count: async () => {
    if (isPostgres()) return getPrisma().user.count();
    return memory.users.count();
  },
};

export default userRepo;
