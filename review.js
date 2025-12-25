import { Scheduler, Card } from '@open-spaced-repetition/sm-2';

// Exporting state so app.js can read/write to it
export let itemsById = {};
export let sm2StateById = {};
let minId = 0;

function ensureMinIdGt(val) {
  if (minId <= val) minId = val + 1;
}

export function setItemsById(val) {
  itemsById = val;
}

/**
 * When setting sm2StateById, we ensure raw JSON objects
 * are converted back into Card instances.
 */
export function setSm2StateById(val) {
  const rehydrated = {};
  for (const id in val) {
    rehydrated[id] = Card.fromJSON(val[id]);
  }
  sm2StateById = rehydrated;
}

/**
 * Merges item data with its scheduling state and returns
 * only what is actually due.
 */
export function getDueItems(mode) {
  const now = Date.now();

  return Object.values(sm2StateById)
    .filter((s) => {
      const isLearnMode = s.n === 0;
      const isReviewMode = s.n >= 1;
      const isCorrectMode = mode === 'learn' ? isLearnMode : isReviewMode;
      const isDue = s.due.getTime() <= now;
      return isCorrectMode && isDue;
    })
    .map((s) => {
      // Merge the static content (front/back) with the dynamic state (due/reps)
      const item = itemsById[s.cardId];
      return {
        ...item,
        scheduling: s, // Keep the library object tucked inside a sub-property
      };
    });
}

export function getCardById(id) {
  return itemsById[id];
}

/**
 * Replaces custom math with the library scheduler.
 * @param {Card} card - The Card instance from the library
 * @param {number} quality - Rating (0-5)
 */
export function sm2Review(id, quality) {
  const card = sm2StateById[id];
  if (!card) return;
  // Scheduler.reviewCard returns { card: Card, reviewLog: ReviewLog }
  const result = Scheduler.reviewCard(card, quality);
  sm2StateById[id] = result.card;
  return result.card;
}

export function parseCsv(text) {
  return text
    .split(/\n?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => {
      const [front, back] = line.split(',');
      return { front: front?.trim() || '', back: back?.trim() || '' };
    })
    .filter((row) => row.front && row.back)
    .map((row) => {
      // Initialize using the library's Card class
      // All new cards are due immediately by default
      const card = minId ? new Card(minId) : new Card();
      const id = card.cardId;
      ensureMinIdGt(id);
      itemsById[id] = {
        id,
        front: row.front,
        back: row.back,
        mode: 'self-grading',
      };
      sm2StateById[id] = card;
      return id;
    });
}
