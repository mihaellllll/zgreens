import api from './client';

// ─── Regal Configs ────────────────────────────────────────────────────────────

export async function fetchRegalConfigs() {
  const { data } = await api.get('/regals');
  return data; // [{ id, name, shelfCount, traysPerShelf, order }]
}

export async function createRegal(name, shelfCount, traysPerShelf) {
  const { data } = await api.post('/regals', { name, shelfCount, traysPerShelf });
  return data;
}

export async function updateRegal(id, updates) {
  const { data } = await api.patch(`/regals/${id}`, updates);
  return data;
}

export async function deleteRegal(id) {
  await api.delete(`/regals/${id}`);
}

// ─── Trays ────────────────────────────────────────────────────────────────────

/**
 * Returns { [regalId]: { [slotIdx]: { cropKey, plantedDate, notes } } }
 */
export async function fetchRegals() {
  const { data } = await api.get('/trays');
  const map = {};
  data.forEach(slot => {
    if (!map[slot.regal]) map[slot.regal] = {};
    map[slot.regal][slot.slot] = {
      cropKey:     slot.cropKey,
      plantedDate: slot.plantedDate,
      notes:       slot.notes,
      batchId:     slot.batchId,
      batch:       slot.batch,
    };
  });
  return map;
}

export async function plantTray(regal, slot, cropKey, plantedDate, notes, seedsToDeduct) {
  const { data } = await api.post(`/trays/${regal}/${slot}/plant`, {
    cropKey, plantedDate, notes, seedsToDeduct,
  });
  return data; // { tray, seedGrams }
}

export async function bulkPlantTrays(entries) {
  const { data } = await api.post('/trays/bulk-plant', { entries });
  return data;
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
  const { data } = await api.post(`/seeds/${encodeURIComponent(cropKey)}/add`, { grams });
  return data.grams;
}

export async function setSeeds(cropKey, grams) {
  const { data } = await api.post(`/seeds/${encodeURIComponent(cropKey)}/set`, { grams });
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
