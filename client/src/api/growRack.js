import api from './client';

// ─── Regals / TraySlots ───────────────────────────────────────────────────────

export async function fetchRegals() {
  const { data } = await api.get('/trays');
  const regals = Array(4).fill(null).map(() => Array(16).fill(null));
  data.forEach(slot => {
    regals[slot.regal][slot.slot] = {
      cropKey:     slot.cropKey,
      plantedDate: slot.plantedDate,
      notes:       slot.notes,
    };
  });
  return regals;
}

export async function plantTray(regal, slot, cropKey, plantedDate, notes, seedsToDeduct) {
  const { data } = await api.post(`/trays/${regal}/${slot}/plant`, {
    cropKey, plantedDate, notes, seedsToDeduct,
  });
  return data; // { tray, seedGrams }
}

export async function clearTray(regal, slot) {
  await api.delete(`/trays/${regal}/${slot}`);
}

export async function deleteAllTrays() {
  await api.delete('/trays');
}

export async function upsertTray(regal, slot, payload) {
  await api.put(`/trays/${regal}/${slot}`, payload);
}

// ─── Seeds ────────────────────────────────────────────────────────────────────

export async function fetchSeeds() {
  const { data } = await api.get('/seeds');
  return data; // { cropKey: grams }
}

export async function addSeeds(cropKey, grams) {
  const { data } = await api.post(`/seeds/${cropKey}/add`, { grams });
  return data.grams;
}

export async function setSeeds(cropKey, grams) {
  const { data } = await api.post(`/seeds/${cropKey}/set`, { grams });
  return data.grams;
}

// ─── Harvests ─────────────────────────────────────────────────────────────────

export async function fetchHarvests() {
  const { data } = await api.get('/harvests');
  return data;
}

export async function createHarvest(payload) {
  const { data } = await api.post('/harvests', payload);
  return data;
}

export async function deleteHarvest(id) {
  await api.delete(`/harvests/${id}`);
}

export async function deleteAllHarvests() {
  await api.delete('/harvests');
}
