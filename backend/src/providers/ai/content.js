/**
 * Multimodal content helpers.
 *
 * Internal message content is either a string or an array of parts:
 *   { type: 'text', text }
 *   { type: 'image', mediaType, data }   // base64, no data: prefix
 *
 * Each provider converts parts to its own wire format.
 */

export const hasImages = (content) => Array.isArray(content) && content.some((part) => part?.type === 'image');

export const flattenText = (content) => {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.filter((part) => part?.type === 'text').map((part) => part.text || '').join('\n');
  return String(content ?? '');
};

export const imageParts = (content) =>
  Array.isArray(content) ? content.filter((part) => part?.type === 'image') : [];

export function toOpenAiContent (content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content.map((part) => {
    if (part.type === 'image') return { type: 'image_url', image_url: { url: `data:${part.mediaType};base64,${part.data}` } };
    return { type: 'text', text: part.text || '' };
  });
}

export function toAnthropicContent (content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return String(content ?? '');
  return content.map((part) => {
    if (part.type === 'image') {
      return { type: 'image', source: { type: 'base64', media_type: part.mediaType, data: part.data } };
    }
    return { type: 'text', text: part.text || '' };
  });
}

export function toGeminiParts (content) {
  if (typeof content === 'string' || content === undefined || content === null) return [{ text: String(content ?? '') }];
  if (!Array.isArray(content)) return [{ text: String(content) }];
  return content.map((part) => {
    if (part.type === 'image') return { inlineData: { mimeType: part.mediaType, data: part.data } };
    return { text: part.text || '' };
  });
}

export default { hasImages, flattenText, imageParts, toOpenAiContent, toAnthropicContent, toGeminiParts };
