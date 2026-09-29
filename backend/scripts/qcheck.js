import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const src = (p) => pathToFileURL(path.join(__dirname, '../src', p)).href;
process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'grounded';
process.env.SEARCH_PROVIDER = 'mock';

const { initDatabase } = await import(src('db/index.js'));
await initDatabase();
const { analyzeQuestion } = await import(src('services/ai/intentService.js'));
const { executeRetrieval } = await import(src('services/ai/retrievalService.js'));
const { buildGroundedAnswer } = await import(src('services/ai/groundedEngine.js'));

const questions = (process.argv[2]
  ? [process.argv[2]]
  : ['What is quantum computing?', 'Compare React and Vue.', 'How does Bitcoin work?']);

for (const q of questions) {
  const analysis = analyzeQuestion(q, { mode: 'AUTO', hasDocuments: false });
  analysis.needsKnowledge = true;
  const retrieval = await executeRetrieval({ question: q, analysis, mode: 'AUTO', userId: null, documentIds: [] });
  const out = buildGroundedAnswer({ question: q, sources: retrieval.sources, documents: [], history: [], mode: 'AUTO' });
  console.log(`\n##### ${q} [${out.strategy}] sources=${retrieval.sources.length}`);
  console.log(JSON.stringify(out.content.slice(0, 1500)));
}
process.exit(0);
