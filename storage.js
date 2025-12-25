import * as Review from './review.js';

function getActiveProfile() {
  const profile = sessionStorage.getItem('learnCards_activeProfile');
  return profile ? parseInt(profile, 10) : 0;
}

function getKey(name) {
    const profile = getActiveProfile();
    return `learnCards_p${profile}_${name}`;
}

const ITEMS_KEY_NAME = 'itemsById';
const STATE_KEY_NAME = 'sm2StateById';

export function saveState() {
  localStorage.setItem(getKey(ITEMS_KEY_NAME), JSON.stringify(Review.state.itemsById));
  localStorage.setItem(getKey(STATE_KEY_NAME), JSON.stringify(Review.state.sm2StateById));
}

export function loadState() {
  const items = localStorage.getItem(getKey(ITEMS_KEY_NAME));
  const sm2 = localStorage.getItem(getKey(STATE_KEY_NAME));

  if (items && sm2) {
    const parsedItems = JSON.parse(items);
    Review.setItemsById(parsedItems);
    Review.setSm2StateById(JSON.parse(sm2));
    return true;
  }
  return false;
}

export function clearState() {
  localStorage.removeItem(getKey(ITEMS_KEY_NAME));
  localStorage.removeItem(getKey(STATE_KEY_NAME));
  window.location.reload();
}
