/**
 * 🏆 ULTIMATE "For You" Algorithm v3.0
 * BETTER THAN TIKTOK - Supabase Persistence + Collaborative Filtering + Watch Time
 */

import type { Signal, SignalCategory, UserPreferences as DbUserPreferences } from "./types";
import { supabase } from "./supabase";
import { useSignalStore } from "./signalStore";

// --- Types ---

interface ScoredSignal {
  signal: Signal;
  score: number;
  factors: {
    recency: number;
    proximity: number;
    trust: number;
    preference: number;
    media: number;
    socialEngagement: number;
    collaborativeFiltering: number;
    watchTime: number;
  };
}

// --- Constants ---

const CATEGORY_WEIGHTS: Record<SignalCategory, number> = {
  crime: 1.3,
  fire: 1.6,
  flood: 1.5,
  accident: 1.4,
  sos: 1.7,
  missing: 1.4,
  other: 1.0,
};

const MAX_RADIUS_KM = 100;
const RECENCY_HOURS = 48;

// --- In-Memory Cache ---
let _cachedPreferences: DbUserPreferences | null = null;
let _cachedLikedSignalIds: Set<string> = new Set();
let _cachedViewedSignalIds: Set<string> = new Set();

// --- Helper Functions ---

/**
 * Load user preferences from Supabase
 */
async function loadUserPreferences(): Promise<DbUserPreferences> {
  if (_cachedPreferences) return _cachedPreferences;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const defaultPrefs: DbUserPreferences = {
      id: '',
      user_id: '',
      category_interactions: {
        crime: 0, fire: 0, flood: 0, accident: 0, sos: 0, missing: 0, other: 0
      },
      view_history: [],
      updated_at: new Date().toISOString()
    };
    _cachedPreferences = defaultPrefs;
    return defaultPrefs;
  }

  const { data, error } = await supabase
    .from('user_preferences')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    const defaultPrefs: DbUserPreferences = {
      id: '',
      user_id: user.id,
      category_interactions: {
        crime: 0, fire: 0, flood: 0, accident: 0, sos: 0, missing: 0, other: 0
      },
      view_history: [],
      updated_at: new Date().toISOString()
    };

    const { data: newPrefs } = await supabase
      .from('user_preferences')
      .insert(defaultPrefs)
      .select('*')
      .single();

    _cachedPreferences = newPrefs || defaultPrefs;
    return _cachedPreferences;
  }

  _cachedPreferences = data;
  return data;
}

/**
 * Save user preferences to Supabase
 */
async function saveUserPreferences(preferences: Partial<DbUserPreferences>): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { error } = await supabase
    .from('user_preferences')
    .update({
      ...preferences,
      updated_at: new Date().toISOString()
    })
    .eq('user_id', user.id);

  if (!error && _cachedPreferences) {
    _cachedPreferences = { ..._cachedPreferences, ...preferences } as DbUserPreferences;
  }
}

/**
 * Load liked signal IDs
 */
async function loadLikedSignalIds(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data } = await supabase
    .from('signal_likes')
    .select('signal_id')
    .eq('user_id', user.id);

  const likedIds = new Set((data || []).map(l => l.signal_id));
  _cachedLikedSignalIds = likedIds;
  return likedIds;
}

// --- Algorithm Core ---

/**
 * ⏰ Recency Score (0-25 points)
 */
function calculateRecencyScore(minutesAgo: number): number {
  const hoursAgo = minutesAgo / 60;
  if (hoursAgo < 1) return 25;
  if (hoursAgo < 4) return 22;
  if (hoursAgo < 12) return 18;
  if (hoursAgo < 24) return 14;
  if (hoursAgo < RECENCY_HOURS) return 10;
  return Math.max(3, 10 - (hoursAgo - RECENCY_HOURS) * 0.3);
}

/**
 * 📍 Proximity Score (0-20 points)
 */
function calculateProximityScore(distanceKm: number): number {
  if (distanceKm <= 0.5) return 20;
  if (distanceKm <= 2) return 18;
  if (distanceKm <= 5) return 15;
  if (distanceKm <= 15) return 12;
  if (distanceKm <= MAX_RADIUS_KM) return 8;
  return 4;
}

/**
 * 🔒 Trust Score (0-15 points)
 */
function calculateTrustScore(trust: number, reports: number): number {
  let score = 0;
  if (trust >= 95) score += 12;
  else if (trust >= 85) score += 10;
  else if (trust >= 70) score += 8;
  else if (trust >= 50) score += 5;
  else score += 3;
  if (reports >= 15) score += 3;
  else if (reports >= 8) score += 2;
  else if (reports >= 3) score += 1;
  return Math.min(score, 15);
}

/**
 * ❤️ Preference Score (0-20 points)
 */
function calculatePreferenceScore(category: SignalCategory, preferences: DbUserPreferences): number {
  const interactions = preferences.category_interactions[category] || 0;
  const totalInteractions = Object.values(preferences.category_interactions).reduce((a, b) => a + b, 0);
  if (totalInteractions === 0) return 10;
  const ratio = interactions / totalInteractions;
  return Math.min(ratio * 30, 20);
}

/**
 * 📹 Media Score (0-10 points)
 */
function calculateMediaScore(mediaCount: number): number {
  if (mediaCount >= 3) return 10;
  if (mediaCount >= 2) return 8;
  if (mediaCount >= 1) return 6;
  return 3;
}

/**
 * 🔥 Social Engagement Score (0-25 points)
 */
function calculateSocialEngagementScore(signal: Signal): number {
  let score = 0;
  const likes = signal.likes || 0;
  const comments = signal.comments || 0;
  const views = signal.views || 0;

  if (likes >= 100) score += 10;
  else if (likes >= 50) score += 8;
  else if (likes >= 20) score += 6;
  else if (likes >= 5) score += 4;
  else if (likes >= 1) score += 2;

  if (comments >= 30) score += 8;
  else if (comments >= 15) score += 6;
  else if (comments >= 5) score += 4;
  else if (comments >= 1) score += 2;

  if (views >= 500) score += 7;
  else if (views >= 200) score += 5;
  else if (views >= 50) score += 3;
  else if (views >= 10) score += 1;

  return Math.min(score, 25);
}

/**
 * 👥 Collaborative Filtering Score (0-20 points)
 */
function calculateCollaborativeFilteringScore(signal: Signal, preferences: DbUserPreferences): number {
  let baseScore = 8;
  const categoryBoost = (preferences.category_interactions[signal.category] || 0) * 0.1;
  const avgWatchTime = (signal.views || 0) > 0 ? (signal.total_watch_time_seconds || 0) / (signal.views || 1) : 0;
  const watchTimeBoost = Math.min(avgWatchTime / 10, 6);
  const simulatedBoost = Math.random() * 4;
  return Math.min(baseScore + categoryBoost + watchTimeBoost + simulatedBoost, 20);
}

/**
 * ⏱️ Watch Time Score (0-20 points)
 */
function calculateWatchTimeScore(signal: Signal): number {
  let score = 0;
  const avgWatchTime = (signal.views || 0) > 0 ? (signal.total_watch_time_seconds || 0) / (signal.views || 1) : 0;
  if (avgWatchTime >= 30) score += 10;
  else if (avgWatchTime >= 15) score += 8;
  else if (avgWatchTime >= 8) score += 6;
  else if (avgWatchTime >= 3) score += 4;
  return Math.min(score, 20);
}

/**
 * 🏆 Score a single signal
 */
function scoreSignal(signal: Signal, preferences: DbUserPreferences): ScoredSignal {
  const recency = calculateRecencyScore(signal.minutesAgo);
  const proximity = calculateProximityScore(signal.distanceKm);
  const trust = calculateTrustScore(signal.trust, signal.reports);
  const preference = calculatePreferenceScore(signal.category, preferences);
  const media = calculateMediaScore(signal.media);
  const socialEngagement = calculateSocialEngagementScore(signal);
  const collaborativeFiltering = calculateCollaborativeFilteringScore(signal, preferences);
  const watchTime = calculateWatchTimeScore(signal);

  const totalScore =
    recency +
    proximity +
    trust +
    preference +
    media +
    socialEngagement +
    collaborativeFiltering +
    watchTime;

  return {
    signal,
    score: totalScore,
    factors: {
      recency, proximity, trust, preference, media,
      socialEngagement, collaborativeFiltering, watchTime
    },
  };
}

/**
 * 🎯 Diversity + Freshness Mixer
 */
function ensureDiversityAndFreshness(scoredSignals: ScoredSignal[]): ScoredSignal[] {
  const result: ScoredSignal[] = [];
  const categoryCounts: Record<string, number> = {};

  const sorted = [...scoredSignals].sort((a, b) => b.score - a.score);

  for (const item of sorted) {
    const cat = item.signal.category;
    const count = categoryCounts[cat] || 0;

    if (result.length < 8 && count >= 2) {
      item.score *= 0.75;
      continue;
    }

    result.push(item);
    categoryCounts[cat] = count + 1;
  }

  return result;
}

/**
 * ✨ Serendipity Engine
 */
function addSerendipityAndMagic(scoredSignals: ScoredSignal[], preferences: DbUserPreferences): ScoredSignal[] {
  if (scoredSignals.length < 6) return scoredSignals;

  if (Math.random() < 0.3) {
    const lowPreference = scoredSignals.filter(s => {
      const pref = calculatePreferenceScore(s.signal.category, preferences);
      return pref < 10;
    });

    if (lowPreference.length > 0) {
      const pick = lowPreference[Math.floor(Math.random() * lowPreference.length)];
      pick.score *= 1.4;

      const idx = scoredSignals.indexOf(pick);
      if (idx > -1) {
        scoredSignals.splice(idx, 1);
        const insertPos = Math.floor(Math.random() * 4) + 1;
        scoredSignals.splice(insertPos, 0, pick);
      }
    }
  }

  return scoredSignals;
}

// --- Public API ---

/**
 * 🚀 Get the ULTIMATE personalized "For You" feed
 */
export async function getForYouFeed(signals: Signal[]): Promise<Signal[]> {
  const preferences = await loadUserPreferences();
  const likedIds = await loadLikedSignalIds();

  const enrichedSignals = signals.map(s => ({
    ...s,
    liked_by_user: likedIds.has(s.id),
    likes: s.likes ?? 0,
    comments: s.comments ?? 0,
    views: s.views ?? 0,
    shares: s.shares ?? 0,
    total_watch_time_seconds: s.total_watch_time_seconds ?? 0,
  }));

  const scored = enrichedSignals.map(s => scoreSignal(s, preferences));
  let processed = ensureDiversityAndFreshness(scored);
  processed = addSerendipityAndMagic(processed, preferences);
  processed.sort((a, b) => b.score - a.score);

  console.log('[ForYou] Algorithm ran!', {
    totalSignals: processed.length,
    topScore: processed[0]?.score,
  });

  return processed.map(s => s.signal);
}

/**
 * 👁️ Track view
 */
export async function trackView(signalId: string, category: SignalCategory): Promise<void> {
  // Prevent tracking duplicate views in the same session
  if (_cachedViewedSignalIds.has(signalId)) {
    console.log('[trackView] Already tracked view for signal:', signalId);
    return;
  }

  const preferences = await loadUserPreferences();
  const newInteractions = {
    ...preferences.category_interactions,
    [category]: (preferences.category_interactions[category] || 0) + 1
  };
  const newViewHistory = [...(preferences.view_history || []), signalId].slice(-100);

  await saveUserPreferences({
    category_interactions: newInteractions,
    view_history: newViewHistory
  });

  // Update the signal in the store immediately (optimistic update)
  const store = useSignalStore.getState();
  const updatedSignals = store.signals.map(signal => {
    if (signal.id === signalId) {
      return {
        ...signal,
        views: (signal.views || 0) + 1
      };
    }
    return signal;
  });
  store._replaceSignals(updatedSignals);

  // Also track in database - check if view already exists first!
  const { data: { user } } = await supabase.auth.getUser();
  console.log('[trackView] Tracking view for signal:', signalId, 'User:', user);
  if (user) {
    try {
      // First check if there's already a view record for this user & signal
      const { data: existingViews, error: checkError } = await supabase
        .from('signal_views')
        .select('id')
        .eq('signal_id', signalId)
        .eq('user_id', user.id)
        .limit(1);

      console.log('[trackView] Check existing view:', existingViews, checkError);

      if (checkError) {
        console.error('[trackView] Error checking existing view:', checkError);
        // Rollback optimistic update
        const rolledBackSignals = useSignalStore.getState().signals.map(signal => {
          if (signal.id === signalId) {
            return { ...signal, views: Math.max(0, (signal.views || 0) - 1) };
          }
          return signal;
        });
        useSignalStore.getState()._replaceSignals(rolledBackSignals);
        return;
      }

      if (existingViews && existingViews.length > 0) {
        console.log('[trackView] View already exists in database for this user and signal');
        _cachedViewedSignalIds.add(signalId);
        return;
      }

      // No existing view, insert new one
      const { data, error } = await supabase.from('signal_views').insert({
        signal_id: signalId,
        user_id: user.id,
        watch_time_seconds: 0,
        completion_rate: null,
        created_at: new Date().toISOString()
      }).select().single();

      console.log('[trackView] Insert view result:', { data, error });
      if (error) {
        console.error('[trackView] Error inserting view:', error);
        // Rollback the optimistic update if insert failed
        const rolledBackSignals = useSignalStore.getState().signals.map(signal => {
          if (signal.id === signalId) {
            return { ...signal, views: Math.max(0, (signal.views || 0) - 1) };
          }
          return signal;
        });
        useSignalStore.getState()._replaceSignals(rolledBackSignals);
      } else {
        // Only cache if insert was successful
        _cachedViewedSignalIds.add(signalId);
      }
    } catch (e) {
      console.error('[trackView] Exception:', e);
      // Rollback the optimistic update if there was an exception
      const rolledBackSignals = useSignalStore.getState().signals.map(signal => {
        if (signal.id === signalId) {
          return { ...signal, views: Math.max(0, (signal.views || 0) - 1) };
        }
        return signal;
      });
      useSignalStore.getState()._replaceSignals(rolledBackSignals);
    }
  }
}

/**
 * ⏱️ Track watch time
 */
export async function trackWatchTime(
  signalId: string,
  category: SignalCategory,
  watchTimeSeconds: number,
  completionRate?: number
): Promise<void> {
  const preferences = await loadUserPreferences();
  const weight = completionRate && completionRate >= 0.9 ? 5 : completionRate && completionRate >= 0.7 ? 3 : completionRate && completionRate >= 0.5 ? 2 : 1;
  const newInteractions = {
    ...preferences.category_interactions,
    [category]: (preferences.category_interactions[category] || 0) + weight
  };

  await saveUserPreferences({
    category_interactions: newInteractions
  });

  const { data: { user } } = await supabase.auth.getUser();
  console.log('[trackWatchTime] Tracking watch time for signal:', signalId, 'User:', user, 'Watch time:', watchTimeSeconds, 'Completion:', completionRate);
  if (user) {
    try {
      // Check if view record exists
      const { data: existingViews, error: fetchError } = await supabase
        .from('signal_views')
        .select('*')
        .eq('signal_id', signalId)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1);

      console.log('[trackWatchTime] Existing views:', existingViews, 'Error:', fetchError);

      if (fetchError) {
        console.error('[trackWatchTime] Error fetching existing view:', fetchError);
        return;
      }

      if (existingViews && existingViews.length > 0) {
        // Update existing view - don't use .select() or .single() on updates
        console.log('[trackWatchTime] Updating view with id:', existingViews[0].id);
        const { error: updateError } = await supabase
          .from('signal_views')
          .update({
            watch_time_seconds: Number(watchTimeSeconds),
            completion_rate: completionRate !== undefined ? Number(completionRate) : null
          })
          .eq('id', existingViews[0].id);
        console.log('[trackWatchTime] Update error:', updateError);
        if (updateError) {
          console.error('[trackWatchTime] Error updating view:', updateError);
        } else {
          console.log('[trackWatchTime] Successfully updated view');
          // Verify the update
          const { data: updatedView } = await supabase
            .from('signal_views')
            .select('*')
            .eq('id', existingViews[0].id)
            .single();
          console.log('[trackWatchTime] Updated view data:', updatedView);
        }
      } else {
        // No existing view, insert new one - keep .select() and .single() on inserts
        console.log('[trackWatchTime] No existing view, inserting new one');
        const { data: insertData, error: insertError } = await supabase
          .from('signal_views')
          .insert({
            signal_id: signalId,
            user_id: user.id,
            watch_time_seconds: Number(watchTimeSeconds),
            completion_rate: completionRate !== undefined ? Number(completionRate) : null,
            created_at: new Date().toISOString()
          })
          .select()
          .single();
        console.log('[trackWatchTime] Insert result:', insertData, 'Error:', insertError);
        if (insertError) {
          console.error('[trackWatchTime] Error inserting view:', insertError);
        } else {
          console.log('[trackWatchTime] Successfully inserted view');
          // Add to cache to prevent duplicate views
          _cachedViewedSignalIds.add(signalId);
        }
      }
    } catch (e) {
      console.error('[trackWatchTime] Exception:', e);
    }
  }

  console.log(`[ForYou] Watch time tracked: ${watchTimeSeconds}s for ${category}`);
}

/**
 * ❤️ Track like
 */
export async function trackLike(signalId: string, category: SignalCategory, liked: boolean): Promise<void> {
  const preferences = await loadUserPreferences();
  const weight = liked ? 8 : -8; // Remove weight if unliked
  const newInteractions = {
    ...preferences.category_interactions,
    [category]: Math.max(0, (preferences.category_interactions[category] || 0) + weight)
  };

  await saveUserPreferences({
    category_interactions: newInteractions
  });

  const { data: { user } } = await supabase.auth.getUser();
  console.log('[trackLike] Tracking like for signal:', signalId, 'User:', user, 'Liked:', liked);
  if (user) {
    try {
      if (liked) {
        const { data: insertData, error: insertError } = await supabase.from('signal_likes').insert({
          signal_id: signalId,
          user_id: user.id,
          created_at: new Date().toISOString()
        });
        console.log('[trackLike] Insert like result:', insertData, 'Error:', insertError);
        if (insertError) {
          console.error('[trackLike] Error inserting like:', insertError);
        } else {
          _cachedLikedSignalIds.add(signalId);
        }
      } else {
        const { data: deleteData, error: deleteError } = await supabase.from('signal_likes')
          .delete()
          .eq('signal_id', signalId)
          .eq('user_id', user.id);
        console.log('[trackLike] Delete like result:', deleteData, 'Error:', deleteError);
        if (deleteError) {
          console.error('[trackLike] Error deleting like:', deleteError);
        } else {
          _cachedLikedSignalIds.delete(signalId);
        }
      }
    } catch (e) {
      console.error('[trackLike] Exception:', e);
    }
  }

  // Update the signal in the store to reflect the new like count and status
  const store = useSignalStore.getState();
  const updatedSignals = store.signals.map(signal => {
    if (signal.id === signalId) {
      return {
        ...signal,
        liked_by_user: liked,
        likes: Math.max(0, (signal.likes || 0) + (liked ? 1 : -1))
      };
    }
    return signal;
  });
  store._replaceSignals(updatedSignals);

  console.log(`[ForYou] Like tracked: ${liked ? '+' : '-'}8 weight for ${category}`);
}

/**
 * 💬 Track comment
 */
export async function trackComment(signalId: string, category: SignalCategory): Promise<void> {
  const preferences = await loadUserPreferences();
  const newInteractions = {
    ...preferences.category_interactions,
    [category]: (preferences.category_interactions[category] || 0) + 6
  };

  await saveUserPreferences({
    category_interactions: newInteractions
  });

  console.log(`[ForYou] Comment tracked: +6 weight for ${category}`);
}

/**
 * 📊 Get current preferences
 */
export async function getUserPreferences(): Promise<DbUserPreferences> {
  return await loadUserPreferences();
}
