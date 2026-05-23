// economy.js - Money & persistent data layer (localStorage-backed)
const STORAGE_KEY = 'emoji_delta_profile';

let profile = null;
let maxEquipSlots = 12; // dynamic, set from operator selection

/** Set the max equipped slots from operator + backpack */
export function setMaxEquipSlots(n) { maxEquipSlots = Math.max(1, n); }
export function getMaxEquipSlots() { return maxEquipSlots; }
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
    passHash: '',
    coins: 50000,
    stash: [],
    equipped: [],
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

/** Get/set username & password */
export function getUsername() {
  if (!profile) loadProfile();
  return profile.username || '';
}

export function setUsername(name) {
  if (!profile) loadProfile();
  profile.username = name;
  saveProfile();
}

/** Simple hash for client-side credential storage */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return hash.toString(16);
}

export function setPassword(pass) {
  if (!profile) loadProfile();
  profile.passHash = pass ? simpleHash(pass) : '';
  saveProfile();
}

export function checkPassword(pass) {
  if (!profile) loadProfile();
  if (!profile.passHash) return true; // no password set yet
  return simpleHash(pass) === profile.passHash;
}

export function hasPassword() {
  if (!profile) loadProfile();
  return !!profile.passHash;
}

/** Get full profile */
export function getProfile() {
  if (!profile) loadProfile();
  return profile;
}

/** Sell item from stash by index, returns coins gained */
export function sellStashItem(index) {
  if (!profile) loadProfile();
  if (index >= 0 && index < profile.stash.length) {
    const item = profile.stash[index];
    const sellPrice = Math.floor((item.value || 1000) * 0.4); // 40% resale
    profile.stash.splice(index, 1);
    profile.coins += sellPrice;
    saveProfile();
    return sellPrice;
  }
  return 0;
}

/** Get equipped loadout items */
export function getEquipped() {
  if (!profile) loadProfile();
  if (!profile.equipped) profile.equipped = [];
  return profile.equipped;
}

/** Equip stash item to loadout (max 4 items, max 2 weapons) */
export function equipItem(stashIndex) {
  if (!profile) loadProfile();
  if (!profile.equipped) profile.equipped = [];
  if (stashIndex < 0 || stashIndex >= profile.stash.length) return false;
  const item = profile.stash[stashIndex];
  // Check weapon limit
  if (item.id && item.id.startsWith('weapon_')) {
    const currentWeapons = profile.equipped.filter(e => e.id && e.id.startsWith('weapon_')).length;
    if (currentWeapons >= 2) return false;
  }
  if (profile.equipped.length >= maxEquipSlots) return false;
  profile.stash.splice(stashIndex, 1);
  profile.equipped.push(item);
  saveProfile();
  return true;
}

/** Unequip item back to stash */
export function unequipItem(equipIndex) {
  if (!profile) loadProfile();
  if (!profile.equipped) profile.equipped = [];
  if (equipIndex >= 0 && equipIndex < profile.equipped.length) {
    const item = profile.equipped.splice(equipIndex, 1)[0];
    profile.stash.push(item);
    saveProfile();
    return true;
  }
  return false;
}

/** Clear equipped loadout (items lost on death) */
export function clearEquipped() {
  if (!profile) loadProfile();
  profile.equipped = [];
  saveProfile();
}

/** Reset entire profile to defaults (clear account) */
export function resetProfile() {
  localStorage.removeItem(STORAGE_KEY);
  profile = createDefault();
  saveProfile();
}
