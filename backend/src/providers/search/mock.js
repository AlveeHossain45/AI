/**
 * MockSearchProvider — clearly-labelled DEMO behaviour.
 *
 * It does NOT fabricate search results about the user's question.
 * It returns a single synthetic entry that explains how to configure a
 * real search provider, flagged with synthetic:true so the pipeline can
 * present it honestly.
 */
import config from '../../config/index.js';
import { SearchProvider } from './base.js';

export class MockSearchProvider extends SearchProvider {
  constructor () {
    super();
    this.name = 'mock';
    this.label = 'Demo (mock search)';
  }

  isAvailable () {
    return config.features.enableMockProviders;
  }

  async search (query) {
    return SearchProvider.normalize(
      [
        {
          title: '[Demo] Search API not configured',
          url: 'https://docs.tavily.com/',
          snippet:
            `No web search provider is configured for the query "${String(query).slice(0, 120)}". ` +
            'Set SEARCH_PROVIDER=tavily|brave|serper and the matching API key in the server environment to enable real web search.',
          content:
            'NovaAI supports Tavily, Brave Search and Serper. Example: SEARCH_PROVIDER=tavily and TAVILY_API_KEY=... ' +
            'Until then, answers that require current web information will fall back to keyless knowledge sources (Wikipedia, arXiv, Crossref, OpenAlex, Open Library) or to clearly-labelled demo text.',
          provider: 'mock',
          synthetic: true,
          score: 0,
        },
      ],
      this.name
    );
  }
}

export default MockSearchProvider;
