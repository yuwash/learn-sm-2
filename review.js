import { Scheduler, Card } from '@open-spaced-repetition/sm-2';

// Exporting state so app.js can read/write to it
export const state = {
  itemsById: {},
  sm2StateById: {},
  minId: 0,
  history: [],
  skipIfReviewedWithinSeconds: 20,
};

export function clear() {
  state.itemsById = {};
  state.sm2StateById = {};
  state.minId = 0;
  clearHistory();
}

export function clearHistory () {
  state.history = [];
}

function ensureMinIdGt(val) {
  if (state.minId <= val) state.minId = val + 1;
}

export function setItemsById(val) {
  state.itemsById = val;
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
  state.sm2StateById = rehydrated;
}

export function getNextDueItem(mode) {
  const now = Date.now();
  const eager = mode === 'review-eager';

  const dueStates = Object.values(state.sm2StateById)
    .filter((s) => {
      const isLearnMode = s.n === 0;
      const isReviewMode = s.n >= 1;
      const isCorrectMode = mode === 'learn' ? isLearnMode : isReviewMode;
      if (!isCorrectMode) return false;
      if (!eager) {
        const isDue = s.due.getTime() <= now;
        if (!isDue) return false;
      }
      if (state.skipIfReviewedWithinSeconds) {
        const lastReview = state.history.reverse().find(
          (h) => h.cardId === s.cardId
        );
        if (lastReview) {
          const timeSinceLastReview = now - lastReview.reviewedAt.getTime();
          if (timeSinceLastReview < state.skipIfReviewedWithinSeconds * 1000) {
            return false;
          }
        }
      }
      return true;
    });
  if (dueStates.length === 0) return null;
  // Merge the static content (front/back) with the dynamic state (due/reps)
  const scheduling = dueStates[0];
  const item = state.itemsById[scheduling.cardId];
  return {
    ...item,
    scheduling, // Keep the library object tucked inside a sub-property
  };
}

export function getCardById(id) {
  return state.itemsById[id];
}

export function getCardDueDate(id) {
  const card = state.sm2StateById[id];
  const due = card ? card.due : null;
  return due ? new Date(due) : null;
}

/**
 * Replaces custom math with the library scheduler.
 * @param {Card} card - The Card instance from the library
 * @param {number} quality - Rating (0-5)
 */
export function sm2Review(id, quality, extraProgress = 0, eager = false) {
  const card = state.sm2StateById[id];
  if (!card) return;
  const now = new Date(Date.now());
  state.history.push({ cardId: id, reviewedAt: now } );
  const reviewDatetime = (
    eager && card.due && now.getTime() < card.due.getTime()
  ) ? card.due: null;
  // Scheduler.reviewCard returns { card: Card, reviewLog: ReviewLog }
  let result = Scheduler.reviewCard(card, quality, reviewDatetime);
  if (extraProgress > 0) {
    // To be used when it was extra easy.
    for (let i = 0; i < extraProgress; i++) {
      result = Scheduler.reviewCard(result.card, quality, result.card.due);
      // Need to override reviewDatetime as it will fail when due date not yet reached.
    }
  }
  state.sm2StateById[id] = result.card;
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
      // Note that no ID is generated here and mode isn’t parsed either.
    })
    .filter((row) => row.front && row.back);
}

export function extendItemsById(parsedData) {
    return parsedData.map((row) => {
      // Initialize using the library's Card class
      // All new cards are due immediately by default
      const card = state.minId ? new Card(state.minId) : new Card();
      const id = card.cardId;
      ensureMinIdGt(id);
      state.itemsById[id] = {
        id,
        front: row.front,
        back: row.back,
        mode: 'self-grading',
      };
      state.sm2StateById[id] = card;
      return id;
    });
}