/**
 * Runtime settings: global (admin-managed) + per-user preferences.
 * Cached briefly so hot paths (chat) don't hammer the database.
 */
import config from '../config/index.js';
import { settingRepo } from '../repositories/settingRepo.js';
import { resetAiProvider } from '../providers/ai/index.js';
import { resetEmbeddingProvider } from '../providers/embeddings/index.js';

const CACHE_MS = 15_000;
let cache = { at: 0, value: null };

export const DEFAULT_GLOBAL_SETTINGS = {
  system_prompt: '',
  show_sources: config.features.showSourcesDefault,
  fact_check: config.features.factCheckEnabled,
  maintenance_mode: config.features.maintenanceMode,
  blocked_domains: [],
  deep_research_max_searches: config.research.maxSearches,
  chat_rate_limit_max: config.limits.chatMax,
  allow_registration: true,
};

export const DEFAULT_USER_PREFERENCES = {
  theme: 'system',
  mode: 'AUTO',
  showSources: config.features.showSourcesDefault,
  enterToSend: true,
  speakAnswers: false,
  analyticsOptOut: false,
};

export async function getGlobalSettings () {
  if (Date.now() - cache.at < CACHE_MS && cache.value) return cache.value;
  try {
    const stored = await settingRepo.allGlobals();
    const value = { ...DEFAULT_GLOBAL_SETTINGS, ...stripNulls(stored) };
    cache = { at: Date.now(), value };
    return value;
  } catch {
    return { ...DEFAULT_GLOBAL_SETTINGS };
  }
}

export async function getSystemPrompt () {
  const settings = await getGlobalSettings();
  return settings.system_prompt || '';
}

export async function isMaintenanceMode () {
  const settings = await getGlobalSettings();
  return Boolean(settings.maintenance_mode);
}

export async function getUserPreferences (userId) {
  if (!userId) return { ...DEFAULT_USER_PREFERENCES };
  try {
    const stored = await settingRepo.getUser(userId, 'preferences');
    return { ...DEFAULT_USER_PREFERENCES, ...(stored || {}) };
  } catch {
    return { ...DEFAULT_USER_PREFERENCES };
  }
}

export async function setUserPreferences (userId, patch) {
  const current = await getUserPreferences(userId);
  const next = { ...current, ...patch };
  await settingRepo.setUser(userId, 'preferences', next);
  return next;
}

export async function updateGlobalSettings (patch) {
  const current = await getGlobalSettings();
  const next = { ...current, ...stripNulls(patch) };
  for (const [key, value] of Object.entries(next)) {
    // eslint-disable-next-line no-await-in-loop
    await settingRepo.setGlobal(key, value);
  }
  invalidateSettingsCache();
  resetAiProvider();
  resetEmbeddingProvider();
  return next;
}

export function invalidateSettingsCache () {
  cache = { at: 0, value: null };
}

const stripNulls = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, value]) => value !== null && value !== undefined));

export default {
  getGlobalSettings,
  getSystemPrompt,
  isMaintenanceMode,
  getUserPreferences,
  setUserPreferences,
  updateGlobalSettings,
  invalidateSettingsCache,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_USER_PREFERENCES,
};
