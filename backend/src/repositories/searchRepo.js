/**
 * Search query/result repository — persists retrieval audits.
 */
import { getPrisma, isPostgres, memory } from '../db/index.js';

export const searchRepo = {
  createQuery: async ({ userId, conversationId, mode, query, provider, latencyMs = 0, results = [] }) => {
    if (isPostgres()) {
      const prisma = getPrisma();
      const row = await prisma.searchQuery.create({
        data: {
          userId: userId || null,
          conversationId: conversationId || null,
          mode,
          query,
          provider: provider || null,
          resultCount: results.length,
          latencyMs,
          results: {
            create: results.map((result, index) => ({
              provider: result.provider || provider || 'unknown',
              url: result.url,
              title: result.title,
              snippet: result.snippet || null,
              content: result.content || null,
              domain: result.domain || null,
              rank: index,
              score: typeof result.score === 'number' ? result.score : null,
            })),
          },
        },
        include: { results: true },
      });
      return row;
    }
    const row = memory.searchQueries.insert({
      userId: userId || null,
      conversationId: conversationId || null,
      mode,
      query,
      provider: provider || null,
      resultCount: results.length,
      latencyMs,
    });
    const stored = results.map((result, index) =>
      memory.searchResults.insert({
        searchQueryId: row.id,
        provider: result.provider || provider || 'unknown',
        url: result.url,
        title: result.title,
        snippet: result.snippet || null,
        content: result.content || null,
        domain: result.domain || null,
        rank: index,
        score: typeof result.score === 'number' ? result.score : null,
      })
    );
    return { ...row, results: stored };
  },

  recentQueries: async (userId, limit = 20) => {
    if (isPostgres()) {
      return getPrisma().searchQuery.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { results: { take: 5, orderBy: { rank: 'asc' } } },
      });
    }
    return memory.searchQueries
      .filter((row) => row.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, limit)
      .map((row) => ({
        ...row,
        results: memory.searchResults
          .filter((r) => r.searchQueryId === row.id)
          .sort((a, b) => a.rank - b.rank)
          .slice(0, 5),
      }));
  },

  countQueries: async () => {
    if (isPostgres()) return getPrisma().searchQuery.count();
    return memory.searchQueries.count();
  },

  countResults: async () => {
    if (isPostgres()) return getPrisma().searchResult.count();
    return memory.searchResults.count();
  },
};

export default searchRepo;
