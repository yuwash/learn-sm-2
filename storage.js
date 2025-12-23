import * as Review from './review.js';

const ITEMS_KEY = 'sr_itemsById';
const STATE_KEY = 'sr_sm2StateById';

export function saveState() {
  localStorage.setItem(ITEMS_KEY, JSON.stringify(Review.itemsById));
  localStorage.setItem(STATE_KEY, JSON.stringify(Review.sm2StateById));
}

export function loadState() {
  const items = localStorage.getItem(ITEMS_KEY);
  const sm2 = localStorage.getItem(STATE_KEY);

  if (items && sm2) {
    const parsedItems = JSON.parse(items);
    Review.setItemsById(parsedItems);
    Review.setSm2StateById(JSON.parse(sm2));
    return true;
  }
  return false;
}

export function clearState() {
  localStorage.removeItem(ITEMS_KEY);
  localStorage.removeItem(STATE_KEY);
  window.location.reload();
}