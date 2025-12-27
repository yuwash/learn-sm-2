import { Scheduler, Card } from '@open-spaced-repetition/sm-2';

// Exporting state so app.js can read/write to it
export const state = {
  itemsById: {},
  sm2StateById: {},
  // To manage virtual cards for different input modes
  // Maps a parent card ID to its virtual children.
  // E.g., { parentId1: { 'prefix1': childId1, ... }, ... }
  childCardsByParentId: {},
  minId: 0,
  history: [],
  itemIdsByAnswer: {},
  skipIfReviewedWithinSeconds: 20,
};

export function clear() {
  state.itemsById = {};
  state.sm2StateById = {};
  state.childCardsByParentId = {};
  state.minId = 0;
  clearHistory();
  state.itemIdsByAnswer = {};
}

export function clearHistory () {
  state.history = [];
}

function ensureMinIdGt(val) {
  if (state.minId <= val) state.minId = val + 1;
}

export function setItemsById(val) {
  state.itemsById = val;
  indexItemIdsByAnswer();
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

export function indexItemIdsByAnswer() {
  const result = Object.values(state.itemsById).reduce(
    (acc, item) => {
      if (!acc[item.back]) acc[item.back] = [];
      acc[item.back].push(item.id);
      return acc;
    },
    {}
  )
  state.itemIdsByAnswer = result;
}

export function getNextDueItem(mode, inputMode, noChildWithInputMode) {
  const now = Date.now();
  const eager = mode === 'review-eager';

  const dueStates = Object.values(state.sm2StateById)
    .filter((s) => {
      const item = state.itemsById[s.cardId];
      // Filter by inputMode if provided, otherwise filter for main cards (no inputMode)
      const isCorrectInputMode = item.inputMode === inputMode || !(inputMode || item.inputMode);
      if (!isCorrectInputMode) return false;

      // Note that s.n is incremented only for ratings >= 3, thus it
      // indicates that user has at least once recalled it correctly.
      const isLearnMode = s.n === 0;
      const isReviewMode = s.n >= 1;
      const isLearnOrRetryMode = isLearnMode || s.needsExtraReview;
      const isCorrectMode = mode === 'learn' ? isLearnMode
        : mode === 'learn-or-retry' ? isLearnOrRetryMode
        : (mode === 'review' || mode === 'review-eager') && isReviewMode;
      if (!isCorrectMode) return false;
      if (!eager) {
        const isDue = s.due.getTime() <= now;
        if (!isDue) return false;
      }
      if (noChildWithInputMode) {
        const children = state.childCardsByParentId[item.id];
        const childExists = children ? Object.keys(children).includes(noChildWithInputMode) : false;
        if (childExists) return false;
      }
      if (state.skipIfReviewedWithinSeconds) {
        const cardIdsWithSameAnswer = state.itemIdsByAnswer[item.back];
        if (cardIdsWithSameAnswer) {
          const lastReview = state.history.slice().reverse().find(
            (h) => cardIdsWithSameAnswer.includes(h.cardId)
          );
          if (lastReview) {
            const timeSinceLastReview = now - lastReview.reviewedAt.getTime();
            if (timeSinceLastReview < state.skipIfReviewedWithinSeconds * 1000) {
              return false;
            }
          }
        }
      }
      return true;
    });

  if (dueStates.length === 0) {
    // If no due cards for the requested inputMode, recursively look for a main card.
    if (inputMode) {
      const parentItem = getNextDueItem('learn-or-retry', undefined, inputMode);
      // If child with that inputMode already exists, then we’ve already seen above that it isn’t due.
      if (parentItem) {
        return getOrCreateChildCard(parentItem, inputMode);
      }
    }
    return null;
  }

  // Merge the static content (front/back) with the dynamic state (due/reps)
  const scheduling = dueStates.reduce((min, s) => (
    (s.due.getTime() < min.due.getTime()) ? s : min
  ));
  const item = state.itemsById[scheduling.cardId];
  return {
    ...item,
    scheduling, // Keep the library object tucked inside a sub-property
  };
}

export function getOrCreateChildCard(parentItem, inputMode) {
  if (!state.childCardsByParentId[parentItem.id]) {
    state.childCardsByParentId[parentItem.id] = {};
  }
  const existingChildId = state.childCardsByParentId[parentItem.id][inputMode];
  if (existingChildId) {
    return {
      ...state.itemsById[existingChildId],
      scheduling: state.sm2StateById[existingChildId]
    };
  }

  // Create a new virtual child card
  const card = state.minId ? new Card(state.minId) : new Card();
  const id = card.cardId;
  ensureMinIdGt(id);

  const childItem = {
    ...parentItem,
    id,
    parentId: parentItem.id,
    inputMode,
  };
  delete childItem.scheduling;

  state.itemsById[id] = childItem;
  state.sm2StateById[id] = card;
  state.childCardsByParentId[parentItem.id][inputMode] = id;
  if (!state.itemIdsByAnswer[childItem.back]) state.itemIdsByAnswer[childItem.back] = [];
  state.itemIdsByAnswer[childItem.back].push(id);

  return {
    ...childItem,
    scheduling: card,
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

export function inputIsCorrect(id, inputMode, input) {
  const scheduling = state.sm2StateById[id];
  const item = state.itemsById[id];
  if (!scheduling || !item) return;
  if (!input) return false;
  if (inputMode === 'prefix1') {
    return item.back.toLowerCase().startsWith(input.toLowerCase());
  }
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
    for (const row of parsedData) {
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
    };
    indexItemIdsByAnswer();
}