const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.get('/', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    const now    = new Date();

    // ── Week boundaries ──────────────────────────────────────────────────────
    const startOfThisWeek = new Date(now);
    startOfThisWeek.setDate(now.getDate() - now.getDay());
    startOfThisWeek.setHours(0, 0, 0, 0);

    const startOfLastWeek = new Date(startOfThisWeek);
    startOfLastWeek.setDate(startOfThisWeek.getDate() - 7);
    const endOfLastWeek = new Date(startOfThisWeek);

    // ── Month boundary ───────────────────────────────────────────────────────
    const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      weeklySales,
      lastWeeklySales,
      monthlySales,
      seeds,
      regals,
      activeTaskCount,
      activeTrayCount,
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { userId, date: { gte: startOfThisWeek } },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { userId, date: { gte: startOfLastWeek, lt: endOfLastWeek } },
        _sum: { total: true },
      }),
      prisma.sale.aggregate({
        where: { userId, date: { gte: startOfThisMonth } },
        _sum: { total: true },
      }),
      prisma.seedStorage.findMany({ where: { userId } }),
      prisma.regal.findMany({ where: { userId }, orderBy: { order: 'asc' } }),
      prisma.task.count({ where: { userId, completed: false } }),
      prisma.traySlot.count({ where: { userId } }),
    ]);

    // ── Total rack capacity ──────────────────────────────────────────────────
    const totalCapacity = regals.reduce((s, r) => s + r.shelfCount * r.traysPerShelf, 0);

    // ── Seed risk: crops with 0g stored ─────────────────────────────────────
    // Fetch crop names to display readable labels
    const cropTypes = await prisma.cropType.findMany({ where: { userId } });
    const cropNameMap = {};
    cropTypes.forEach(c => { cropNameMap[c.name] = c; });

    const lowSeeds = seeds
      .filter(s => s.grams <= 0)
      .map(s => ({ cropKey: s.cropKey, grams: s.grams, name: s.cropKey }));

    res.json({
      weeklyRevenue:   weeklySales._sum.total    ?? 0,
      lastWeekRevenue: lastWeeklySales._sum.total ?? 0,
      monthlyRevenue:  monthlySales._sum.total   ?? 0,
      totalCapacity,
      lowSeeds,
      activeTaskCount,
      activeTrayCount,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
