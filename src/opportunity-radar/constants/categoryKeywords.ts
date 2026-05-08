/**
 * Static map of app-store category slugs → keyword lists.
 * Used by marketScorer.ts to infer which category a cluster belongs to
 * by comparing the cluster's keyTerms against each keyword list.
 * Category with the highest overlap fraction wins; must exceed 0.20 to qualify.
 */
export const CATEGORY_KEYWORDS: Record<string, string[]> = {
  productivity: [
    'task', 'todo', 'note', 'calendar', 'focus', 'plan', 'reminder',
    'schedule', 'workflow', 'organize', 'project', 'deadline', 'checklist',
    'agenda', 'meeting', 'time', 'track', 'manager', 'productivity',
  ],
  finance: [
    'budget', 'expense', 'invest', 'bank', 'money', 'payment', 'tax',
    'saving', 'crypto', 'wallet', 'transaction', 'portfolio', 'stock',
    'income', 'debt', 'loan', 'receipt', 'billing', 'finance', 'cost',
  ],
  entertainment: [
    'video', 'stream', 'watch', 'movie', 'podcast', 'music', 'media',
    'content', 'show', 'episode', 'film', 'series', 'play', 'listen',
    'channel', 'live', 'broadcast', 'entertainment',
  ],
  shopping: [
    'buy', 'shop', 'cart', 'order', 'product', 'store', 'price', 'deal',
    'checkout', 'delivery', 'purchase', 'wishlist', 'discount', 'coupon',
    'marketplace', 'seller', 'review', 'shipping', 'shopping',
  ],
  social: [
    'post', 'share', 'follow', 'friend', 'feed', 'chat', 'message',
    'community', 'comment', 'profile', 'group', 'connect', 'network',
    'social', 'mention', 'reply', 'like', 'dm', 'inbox',
  ],
  games: [
    'game', 'play', 'level', 'score', 'multiplayer', 'puzzle', 'quest',
    'achievement', 'character', 'battle', 'strategy', 'simulation',
    'arcade', 'adventure', 'rpg', 'gaming', 'leaderboard', 'reward',
  ],
  'health-fitness': [
    'health', 'fitness', 'workout', 'sleep', 'diet', 'calories', 'steps',
    'meditation', 'run', 'exercise', 'heart', 'weight', 'nutrition',
    'mental', 'wellness', 'yoga', 'strength', 'training', 'habit',
  ],
  utilities: [
    'file', 'scan', 'convert', 'compress', 'backup', 'transfer', 'storage',
    'password', 'vpn', 'clean', 'tool', 'utility', 'pdf', 'format',
    'encrypt', 'sync', 'automate', 'shortcut', 'system',
  ],
}
