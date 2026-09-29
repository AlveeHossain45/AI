/**
 * API usage / analytics repository.
 */
import { getPrisma, isPostgres, memory } from '../db/index.js';

export const usageRepo = {
  record: async (data) => {
    const payload = {
      userId: data.userId || null,
      endpoint: data.endpoint,
      provider: data.provider || null,
      model: data.model || null,
      promptTokens: data.promptTokens || 0,
      completionTokens: data.completionTokens || 0,
      totalTokens: data.totalTokens || 0,
      latencyMs: data.latencyMs || 0,
      status: data.status || 'ok',
      errorCode: data.errorCode || null,
      estimatedCost: data.estimatedCost || 0,
      metadata: data.metadata || undefined,
    };
    if (isPostgres()) return getPrisma().apiUsage.create({ data: payload });
    return memory.apiUsage.insert(payload);
  },

  summary: async ({ days = 30 } = {}) => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    if (isPostgres()) {
      const prisma = getPrisma();
      const where = { createdAt: { gte: since } };
      const [totals, byModel, byProvider, byStatus, daily] = await Promise.all([
        prisma.apiUsage.aggregate({
          where,
          _count: { id: true },
          _sum: { totalTokens: true, promptTokens: true, completionTokens: true, estimatedCost: true },
          _avg: { latencyMs: true },
        }),
        prisma.apiUsage.groupBy({ by: ['model'], where, _count: { id: true }, _sum: { totalTokens: true, estimatedCost: true }, orderBy: { _count: { id: 'desc' } }, take: 10 }),
        prisma.apiUsage.groupBy({ by: ['provider'], where, _count: { id: true }, _sum: { totalTokens: true, estimatedCost: true } }),
        prisma.apiUsage.groupBy({ by: ['status'], where, _count: { id: true } }),
        prisma.$queryRaw`
          SELECT date_trunc('day', "createdAt")::date AS day,
                 COUNT(*)::int AS requests,
                 COALESCE(SUM("totalTokens"), 0)::int AS tokens
          FROM api_usage
          WHERE "createdAt" >= ${since}
          GROUP BY 1 ORDER BY 1 ASC
        `,
      ]);
      const errors = byStatus.find((row) => row.status !== 'ok')?._count?.id || 0;
      const requests = totals._count.id || 0;
      return {
        requests,
        totalTokens: totals._sum.totalTokens || 0,
        promptTokens: totals._sum.promptTokens || 0,
        completionTokens: totals._sum.completionTokens || 0,
        estimatedCost: Number((totals._sum.estimatedCost || 0).toFixed(4)),
        avgLatencyMs: Math.round(totals._avg.latencyMs || 0),
        errorRate: requests ? Number((errors / requests).toFixed(4)) : 0,
        byModel: byModel.map((row) => ({ model: row.model || 'unknown', requests: row._count.id, tokens: row._sum.totalTokens || 0, cost: Number((row._sum.estimatedCost || 0).toFixed(4)) })),
        byProvider: byProvider.map((row) => ({ provider: row.provider || 'unknown', requests: row._count.id, tokens: row._sum.totalTokens || 0, cost: Number((row._sum.estimatedCost || 0).toFixed(4)) })),
        byStatus: byStatus.map((row) => ({ status: row.status, count: row._count.id })),
        daily: daily.map((row) => ({ day: String(row.day).slice(0, 10), requests: row.requests, tokens: row.tokens })),
        windowDays: days,
      };
    }
    const rows = memory.apiUsage.filter((row) => new Date(row.createdAt) >= since);
    const requests = rows.length;
    const errors = rows.filter((row) => row.status !== 'ok').length;
    const sum = (fn) => rows.reduce((acc, row) => acc + (fn(row) || 0), 0);
    const group = (key) => {
      const map = new Map();
      for (const row of rows) {
        const k = row[key] || 'unknown';
        const entry = map.get(k) || { [key]: k, requests: 0, tokens: 0, cost: 0 };
        entry.requests += 1;
        entry.tokens += row.totalTokens || 0;
        entry.cost += row.estimatedCost || 0;
        map.set(k, entry);
      }
      return [...map.values()].map((entry) => ({ ...entry, cost: Number(entry.cost.toFixed(4)) }));
    };
    const byStatus = new Map();
    for (const row of rows) byStatus.set(row.status, (byStatus.get(row.status) || 0) + 1);
    const byDay = new Map();
    for (const row of rows) {
      const day = new Date(row.createdAt).toISOString().slice(0, 10);
      const entry = byDay.get(day) || { day, requests: 0, tokens: 0 };
      entry.requests += 1;
      entry.tokens += row.totalTokens || 0;
      byDay.set(day, entry);
    }
    return {
      requests,
      totalTokens: sum((row) => row.totalTokens),
      promptTokens: sum((row) => row.promptTokens),
      completionTokens: sum((row) => row.completionTokens),
      estimatedCost: Number(sum((row) => row.estimatedCost).toFixed(4)),
      avgLatencyMs: requests ? Math.round(sum((row) => row.latencyMs) / requests) : 0,
      errorRate: requests ? Number((errors / requests).toFixed(4)) : 0,
      byModel: group('model'),
      byProvider: group('provider'),
      byStatus: [...byStatus.entries()].map(([status, count]) => ({ status, count })),
      daily: [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day)),
      windowDays: days,
    };
  },

  userUsage: async (userId, { days = 30 } = {}) => {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    if (isPostgres()) {
      const agg = await getPrisma().apiUsage.aggregate({
        where: { userId, createdAt: { gte: since } },
        _count: { id: true },
        _sum: { totalTokens: true, estimatedCost: true },
      });
      return { requests: agg._count.id || 0, tokens: agg._sum.totalTokens || 0, estimatedCost: Number((agg._sum.estimatedCost || 0).toFixed(4)) };
    }
    const rows = memory.apiUsage.filter((row) => row.userId === userId && new Date(row.createdAt) >= since);
    return {
      requests: rows.length,
      tokens: rows.reduce((acc, row) => acc + (row.totalTokens || 0), 0),
      estimatedCost: Number(rows.reduce((acc, row) => acc + (row.estimatedCost || 0), 0).toFixed(4)),
    };
  },
};

export default usageRepo;
