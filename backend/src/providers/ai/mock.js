/**
 * MockAIProvider — clearly-labelled DEMO mode.
 *
 * It never invents real-world facts. It only:
 *  - restructures what the user asked
 *  - summarizes context that was actually retrieved (docs/search snippets)
 *  - explains that a real AI provider must be configured for full answers
 */
import config from '../../config/index.js';
import { AiProvider } from './base.js';
import { estimateTokens } from '../../utils/text.js';
import { flattenText, imageParts } from './content.js';

export class MockAiProvider extends AiProvider {
  constructor () {
    super();
    this.name = 'mock';
    this.label = 'Demo (mock)';
  }

  isAvailable () {
    return config.features.enableMockProviders;
  }

  defaultModel () {
    return 'novaai-demo';
  }

  buildAnswer (messages, options = {}) {
    const userMessage = [...messages].reverse().find((m) => m.role === 'user');
    const question = flattenText(userMessage?.content) || '';
    const images = imageParts(userMessage?.content || []);
    const contextBlocks = messages.filter((m) => m.role === 'system').map((m) => flattenText(m.content)).join('\n');
    const hasSources = /SOURCE \d+/i.test(contextBlocks) || /DOCUMENT EXCERPT/i.test(contextBlocks);

    const sections = [];
    sections.push('> **Demo mode** — NovaAI is running with the built-in `MockAIProvider` because no AI API key is configured. No real model generated this text, and no real-world facts are being asserted.');
    sections.push('');
    sections.push(`### Your question`);
    sections.push('');
    sections.push(`"${question.split('\n')[0].slice(0, 300)}"`);
    sections.push('');

    if (hasSources) {
      sections.push('### What was actually retrieved');
      sections.push('');
      sections.push('NovaAI assembled the following **real retrieved context** for this question (from your documents or the search connector). A configured model would now synthesize it into an answer:');
      sections.push('');
      const excerpts = contextBlocks
        .split(/SOURCE \d+/i)
        .slice(1, 4)
        .map((chunk) => chunk.trim().split('\n').slice(0, 3).join(' ').slice(0, 400))
        .filter(Boolean);
      excerpts.forEach((excerpt, index) => sections.push(`${index + 1}. ${excerpt}`));
      sections.push('');
    }

    if (images.length) {
      sections.push(`### Image input detected`);
      sections.push('');
      sections.push(
        `${images.length} image(s) were attached. The demo model cannot see them — configure a vision-capable provider ` +
          '(`openai`, `anthropic` or `gemini`) and NovaAI will pass the images through automatically.'
      );
      sections.push('');
    }

    sections.push('### What you would get with a real provider');
    sections.push('');
    sections.push('- **Set `AI_PROVIDER`** to `openai`, `anthropic`, or `gemini` and add the matching API key in `.env`.');
    sections.push('- NovaAI then routes the request: intent detection → retrieval (web/docs/both) → context building → streamed answer with citations.');
    sections.push('- Search (`SEARCH_PROVIDER`) enables current-information answers via Tavily, Brave or Serper.');
    sections.push('');
    sections.push('```bash');
    sections.push('# backend/.env');
    sections.push('AI_PROVIDER=openai');
    sections.push('OPENAI_API_KEY=sk-...');
    sections.push('SEARCH_PROVIDER=tavily');
    sections.push('TAVILY_API_KEY=tvly-...');
    sections.push('```');
    sections.push('');
    sections.push('See the README for the full provider matrix.');

    if (options.system?.includes('JSON')) {
      return JSON.stringify({ demo: true, intent: 'general', note: 'mock provider' });
    }
    return sections.join('\n');
  }

  async chat (messages, options = {}) {
    const content = this.buildAnswer(messages, options);
    const model = this.resolveModel(options.model);
    return {
      content,
      model,
      usage: { promptTokens: estimateTokens(messages.map((m) => flattenText(m.content)).join(' ')), completionTokens: estimateTokens(content) },
      finishReason: 'stop',
    };
  }

  async *stream (messages, options = {}) {
    const content = this.buildAnswer(messages, options);
    const model = this.resolveModel(options.model);
    const tokens = content.match(/\S+\s*/g) || [content];
    for (const token of tokens) {
      if (options.signal?.aborted) break;
      yield { type: 'delta', text: token };
      await new Promise((resolve) => setTimeout(resolve, 8));
    }
    yield {
      type: 'done',
      model,
      usage: { promptTokens: estimateTokens(messages.map((m) => flattenText(m.content)).join(' ')), completionTokens: estimateTokens(content) },
      finishReason: 'stop',
    };
  }
}

export default MockAiProvider;
