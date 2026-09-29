/**
 * Document + chunk repository (RAG storage).
 */
import { getPrisma, isPostgres, memory } from '../db/index.js';

export const documentRepo = {
  create: async (data) => {
    if (isPostgres()) return getPrisma().document.create({ data });
    return memory.documents.insert({ status: 'PROCESSING', chunkCount: 0, ...data });
  },

  findById: async (id, userId) => {
    if (isPostgres()) {
      return getPrisma().document.findFirst({ where: { id, ...(userId ? { userId } : {}) }, include: { chunks: { orderBy: { idx: 'asc' } } } });
    }
    const row = memory.documents.get(id);
    if (!row || (userId && row.userId !== userId)) return null;
    const chunks = memory.documentChunks.filter((c) => c.documentId === id).sort((a, b) => a.idx - b.idx);
    return { ...row, chunks };
  },

  listByUser: async (userId, { limit = 100, offset = 0 } = {}) => {
    if (isPostgres()) {
      const where = { userId };
      const [rows, total] = await Promise.all([
        getPrisma().document.findMany({ where, orderBy: { createdAt: 'desc' }, take: limit, skip: offset }),
        getPrisma().document.count({ where }),
      ]);
      return { rows, total };
    }
    const rows = memory.documents
      .filter((row) => row.userId === userId)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return { rows: rows.slice(offset, offset + limit), total: rows.length };
  },

  update: async (id, patch) => {
    if (isPostgres()) return getPrisma().document.update({ where: { id }, data: patch });
    return memory.documents.update(id, patch);
  },

  remove: async (id, userId) => {
    if (isPostgres()) {
      const res = await getPrisma().document.deleteMany({ where: { id, ...(userId ? { userId } : {}) } });
      return res.count > 0;
    }
    const row = memory.documents.get(id);
    if (!row || (userId && row.userId !== userId)) return false;
    memory.embeddings.removeWhere((e) => e.documentId === id);
    memory.documentChunks.removeWhere((c) => c.documentId === id);
    memory.documents.remove(id);
    return true;
  },

  createChunks: async (documentId, chunks) => {
    if (isPostgres()) {
      return getPrisma().documentChunk.createMany({
        data: chunks.map((chunk, index) => ({
          documentId,
          idx: chunk.idx ?? index,
          content: chunk.content,
          tokenCount: chunk.tokenCount || 0,
          pageNumber: chunk.pageNumber ?? null,
        })),
      });
    }
    return chunks.map((chunk, index) =>
      memory.documentChunks.insert({
        documentId,
        idx: chunk.idx ?? index,
        content: chunk.content,
        tokenCount: chunk.tokenCount || 0,
        pageNumber: chunk.pageNumber ?? null,
      })
    );
  },

  createEmbeddings: async (entries) => {
    if (isPostgres()) {
      const prisma = getPrisma();
      // Vector values must be passed through Prisma.sql to stay parameterised.
      const results = [];
      for (const entry of entries) {
        const literal = vectorLiteral(entry.vector);
        // eslint-disable-next-line no-await-in-loop
        const row = await prisma.$queryRaw`
          INSERT INTO embeddings (id, "chunkId", "documentId", model, dimensions, vector, "contentHash", "createdAt")
          VALUES (gen_random_uuid(), ${entry.chunkId}::uuid, ${entry.documentId}::uuid, ${entry.model},
                  ${entry.dimensions}, ${literal}::vector, ${entry.contentHash}, now())
          ON CONFLICT ("chunkId") DO UPDATE
            SET model = EXCLUDED.model, dimensions = EXCLUDED.dimensions,
                vector = EXCLUDED.vector, "contentHash" = EXCLUDED."contentHash"
          RETURNING id
        `;
        results.push(row);
      }
      return results;
    }
    return entries.map((entry) =>
      memory.embeddings.insert({
        chunkId: entry.chunkId,
        documentId: entry.documentId,
        model: entry.model,
        dimensions: entry.dimensions,
        vector: entry.vector,
        contentHash: entry.contentHash,
      })
    );
  },

  /** Cosine similarity search across a user's document chunks. */
  similaritySearch: async (userId, vector, { topK = 8, documentIds = null } = {}) => {
    if (isPostgres()) {
      // Fetch a wider candidate set, then apply the optional document filter in JS.
      const fetchLimit = documentIds?.length ? Math.max(topK * 8, 64) : topK;
      const rows = await getPrisma().$queryRaw`
        SELECT c.id AS "chunkId", c."documentId", c.content, c."pageNumber", c.idx,
               d.filename, 1 - (e.vector <=> ${vectorLiteral(vector)}::vector) AS score
        FROM embeddings e
        JOIN document_chunks c ON c.id = e."chunkId"
        JOIN documents d ON d.id = c."documentId"
        WHERE d.userId = ${userId}::uuid
        ORDER BY e.vector <=> ${vectorLiteral(vector)}::vector
        LIMIT ${fetchLimit}
      `;
      let mapped = rows.map((row) => ({ ...row, score: Number(row.score) }));
      if (documentIds?.length) mapped = mapped.filter((row) => documentIds.includes(row.documentId));
      return mapped.slice(0, topK);
    }
    const embeddings = memory.embeddings.all();
    const scored = [];
    for (const embedding of embeddings) {
      const chunk = memory.documentChunks.get(embedding.chunkId);
      const doc = memory.documents.get(embedding.documentId);
      if (!chunk || !doc || doc.userId !== userId) continue;
      if (documentIds?.length && !documentIds.includes(doc.id)) continue;
      const score = cosine(embedding.vector, vector);
      scored.push({
        chunkId: chunk.id,
        documentId: doc.id,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        idx: chunk.idx,
        filename: doc.filename,
        score,
      });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  },
};

const vectorLiteral = (vector) => `[${vector.map((v) => Number(v).toFixed(7)).join(',')}]`;

const cosine = (a, b) => {
  if (!a?.length || !b?.length || a.length !== b.length) return -1;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (!na || !nb) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

export default documentRepo;
