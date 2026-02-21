const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const batches = await prisma.batch.findMany({
      include: {
        cropType: true,
        costs: true,
        saleItems: true
      }
    });

    const byId = {};
    batches.forEach(batch => {
      const name = batch.cropType.name;
      if (!byId[name]) {
        byId[name] = {
          cropName: name,
          batchCount: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalYieldG: 0,
          harvestedCount: 0
        };
      }
      const revenue = batch.saleItems.reduce((s, si) => s + si.subtotal, 0);
      const cost = batch.costs.reduce((s, c) => s + c.amount, 0);
      byId[name].batchCount += 1;
      byId[name].totalRevenue += revenue;
      byId[name].totalCost += cost;
      byId[name].totalYieldG += batch.yieldGrams || 0;
      if (batch.status === 'harvested') byId[name].harvestedCount += 1;
    });

    const result = Object.values(byId).map(crop => ({
      ...crop,
      profit: crop.totalRevenue - crop.totalCost,
      margin: crop.totalRevenue > 0 ? ((crop.totalRevenue - crop.totalCost) / crop.totalRevenue) * 100 : 0,
      roi: crop.totalCost > 0 ? ((crop.totalRevenue - crop.totalCost) / crop.totalCost) * 100 : 0,
    })).sort((a, b) => b.profit - a.profit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
