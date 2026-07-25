/**
 * Simple rule-based sentiment analysis (no external API required).
 * For P2, this can be swapped with Gemini/OpenRouter API call.
 */

const POSITIVE_WORDS = [
  'amazing', 'excellent', 'fantastic', 'great', 'outstanding', 'wonderful',
  'love', 'loved', 'perfect', 'best', 'awesome', 'brilliant', 'superb',
  'exceptional', 'incredible', 'highly recommend', 'recommend', 'happy',
  'satisfied', 'impressed', 'professional', 'efficient', 'helpful',
  'responsive', 'quality', 'reliable', 'trust', 'delighted', 'pleased',
  'top-notch', 'exceeded', 'beyond expectations', 'good', 'nice', 'solid',
];

const NEGATIVE_WORDS = [
  'terrible', 'awful', 'horrible', 'bad', 'poor', 'worst', 'disappointing',
  'disappointed', 'frustrating', 'frustrated', 'useless', 'waste', 'wasted',
  'broken', 'failed', 'failure', 'never', 'avoid', 'scam', 'rude',
  'unprofessional', 'slow', 'unreliable', 'unhelpful', 'problem', 'issues',
  'complaints', 'regret', 'refund', 'cancel',
];

/**
 * Returns { sentiment: 'positive'|'neutral'|'negative', score: -1 to 1 }
 */
const analyzeSentiment = (text) => {
  const lower = text.toLowerCase();
  let score = 0;

  POSITIVE_WORDS.forEach((word) => {
    if (lower.includes(word)) score += 1;
  });

  NEGATIVE_WORDS.forEach((word) => {
    if (lower.includes(word)) score -= 1;
  });

  // Normalize score to -1..1 range
  const wordCount = text.split(/\s+/).length;
  const normalizedScore = Math.max(-1, Math.min(1, score / Math.max(1, wordCount / 5)));

  let sentiment;
  if (normalizedScore > 0.05) sentiment = 'positive';
  else if (normalizedScore < -0.05) sentiment = 'negative';
  else sentiment = 'neutral';

  return { sentiment, score: Math.round(normalizedScore * 100) / 100 };
};

module.exports = { analyzeSentiment };