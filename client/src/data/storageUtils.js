const STORAGE_KEY = 'zgreens_seed_storage';

export function getStorage() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
  catch { return {}; }
}

export function saveStorage(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getSeedAmount(cropKey) {
  return getStorage()[cropKey] ?? 0;
}

export function addSeeds(cropKey, grams) {
  const s = getStorage();
  s[cropKey] = (s[cropKey] ?? 0) + Number(grams);
  saveStorage(s);
}

export function deductSeeds(cropKey, grams) {
  const s = getStorage();
  s[cropKey] = Math.max(0, (s[cropKey] ?? 0) - Number(grams));
  saveStorage(s);
}
