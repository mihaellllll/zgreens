const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [activeBatches, upcomingHarvests, pendingTasks, weeklySales] = await Promise.all([
      prisma.batch.count({ where: { userId: req.user.id, status: { notIn: ['harvested', 'failed'] } } }),
      prisma.batch.findMany({
        where: {
          userId: req.user.id,
          status: { notIn: ['harvested', 'failed'] },
          expectedHarvestDate: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) }
        },
        include: { cropType: true },
        orderBy: { expectedHarvestDate: 'asc' },
        take: 5
      }),
      prisma.task.count({ where: { userId: req.user.id, completed: false } }),
      prisma.sale.aggregate({
        where: { userId: req.user.id, date: { gte: startOfWeek } },
        _sum: { total: true }
      })
    ]);

    // Top profitable crop (by avg margin)
    const harvested = await prisma.batch.findMany({
      where: { userId: req.user.id, status: 'harvested', yieldGrams: { gt: 0 } },
      include: {
        cropType: true,
        costs: true,
        saleItems: true
      }
    });

    const cropProfit = {};
    harvested.forEach(batch => {
      const revenue = batch.saleItems.reduce((s, si) => s + si.subtotal, 0);
      const cost = batch.costs.reduce((s, c) => s + c.amount, 0);
      const profit = revenue - cost;
      const name = batch.cropType.name;
      if (!cropProfit[name]) cropProfit[name] = { profit: 0, count: 0 };
      cropProfit[name].profit += profit;
      cropProfit[name].count += 1;
    });

    let topCrop = null;
    let topProfit = -Infinity;
    Object.entries(cropProfit).forEach(([name, { profit, count }]) => {
      const avg = profit / count;
      if (avg > topProfit) { topProfit = avg; topCrop = name; }
    });

    // Recent batches
    const recentBatches = await prisma.batch.findMany({
      where: { userId: req.user.id },
      include: { cropType: true },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    res.json({
      activeBatches,
      upcomingHarvests,
      pendingTasks,
      weeklyRevenue: weeklySales._sum.total || 0,
      topCrop,
      recentBatches
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
