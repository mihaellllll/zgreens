const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

/**
 * GET /api/profitability
 *
 * Aggregates profitability from multiple sources so users who only use
 * the tray-based workflow (without Batches) still see their data:
 *   - Revenue: from all SaleItems (through Sales), grouped by cropName
 *   - Yield: from all Harvest records, grouped by cropName
 *   - Costs: from Batch.costs (if batches exist), grouped by cropType.name
 */
router.get('/', auth, async (req, res) => {
  try {
    const { from, to } = req.query;
    const dateFilter = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const toDate = new Date(to);
      toDate.setHours(23, 59, 59, 999);
      dateFilter.lte = toDate;
    }
    const hasDateFilter = Object.keys(dateFilter).length > 0;

    const [sales, harvests, batches] = await Promise.all([
      prisma.sale.findMany({
        where: {
          userId: req.user.id,
          ...(hasDateFilter && { date: dateFilter }),
        },
        include: { items: true },
      }),
      prisma.harvest.findMany({
        where: {
          userId: req.user.id,
          ...(hasDateFilter && { createdAt: dateFilter }),
        },
      }),
      prisma.batch.findMany({
        where: {
          userId: req.user.id,
          ...(hasDateFilter && { sowDate: dateFilter }),
        },
        include: { cropType: true, costs: true },
      }),
    ]);

    const byName = {};
    const ensure = name => {
      if (!byName[name]) byName[name] = {
        cropName: name,
        totalRevenue: 0,
        totalCost: 0,
        totalYieldG: 0,
        harvestedCount: 0,
        batchCount: 0,
      };
    };

    // Revenue from all sale items (regardless of batchId linkage)
    sales.forEach(sale => {
      sale.items.forEach(item => {
        if (!item.cropName) return;
        ensure(item.cropName);
        byName[item.cropName].totalRevenue += item.subtotal;
      });
    });

    // Yield from harvest records
    harvests.forEach(h => {
      ensure(h.cropName);
      byName[h.cropName].totalYieldG += h.yieldG || 0;
      byName[h.cropName].harvestedCount += 1;
    });

    // Costs from batch records (seed costs, substrate, etc.)
    batches.forEach(batch => {
      const name = batch.cropType.name;
      ensure(name);
      byName[name].batchCount += 1;
      batch.costs.forEach(c => { byName[name].totalCost += c.amount; });
    });

    const result = Object.values(byName)
      .filter(c => c.totalRevenue > 0 || c.totalYieldG > 0 || c.batchCount > 0)
      .map(crop => ({
        ...crop,
        profit: crop.totalRevenue - crop.totalCost,
        margin: crop.totalRevenue > 0
          ? ((crop.totalRevenue - crop.totalCost) / crop.totalRevenue) * 100
          : 0,
        roi: crop.totalCost > 0
          ? ((crop.totalRevenue - crop.totalCost) / crop.totalCost) * 100
          : 0,
      }))
      .sort((a, b) => b.profit - a.profit);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
