// economy.js - Money & persistent data layer (localStorage-backed)
const STORAGE_KEY = 'emoji_delta_profile';

let profile = null;

/** Load profile from localStorage */
export function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      profile = JSON.parse(raw);
    } else {
      profile = createDefault();
      saveProfile();
    }
  } catch (e) {
    console.warn('Failed to load profile, creating new:', e.message);
    profile = createDefault();
  }
  return profile;
}

function createDefault() {
  return {
    username: '',
    coins: 50000,       // Starting balance per Master.md
    stash: [],          // Items in warehouse
    createdAt: Date.now()
  };
}

/** Persist to localStorage */
export function saveProfile() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (e) {
    console.warn('Failed to save profile:', e.message);
  }
}

/** Get current coins */
export function getCoins() {
  return profile ? profile.coins : 50000;
}

/** Add coins (earning) */
export function addCoins(amount) {
  if (!profile) loadProfile();
  profile.coins += amount;
  saveProfile();
  return profile.coins;
}

/** Spend coins (buying) — returns false if insufficient */
export function spendCoins(amount) {
  if (!profile) loadProfile();
  if (profile.coins < amount) return false;
  profile.coins -= amount;
  saveProfile();
  return true;
}

/** Get stash items */
export function getStash() {
  if (!profile) loadProfile();
  return profile.stash;
}

/** Add item to stash */
export function addToStash(item) {
  if (!profile) loadProfile();
  profile.stash.push(item);
  saveProfile();
}

/** Remove item from stash by index */
export function removeFromStash(index) {
  if (!profile) loadProfile();
  if (index >= 0 && index < profile.stash.length) {
    profile.stash.splice(index, 1);
    saveProfile();
    return true;
  }
  return false;
}

/** Get/set username */
export function getUsername() {
  if (!profile) loadProfile();
  return profile.username || '';
}

export function setUsername(name) {
  if (!profile) loadProfile();
  profile.username = name;
  saveProfile();
}

/** Get full profile */
export function getProfile() {
  if (!profile) loadProfile();
  return profile;
}
