const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const Groq = require('groq-sdk');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

const SHELF_LABEL = (slot) => `Polica ${Math.floor(slot / 4) + 1}, Plitice ${(slot % 4) + 1}`;

router.post('/chat', auth, async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY nije postavljen na serveru.' });
  }

  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Poruka je obavezna.' });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const now = new Date();

    // Gather all farm data in parallel
    const [trays, seeds, harvests, sales, tasks, batches, customers] = await Promise.all([
      prisma.traySlot.findMany({ orderBy: [{ regal: 'asc' }, { slot: 'asc' }] }),
      prisma.seedStorage.findMany(),
      prisma.harvest.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
      prisma.sale.findMany({ orderBy: { date: 'desc' }, take: 20, include: { items: true, customer: true } }),
      prisma.task.findMany({ where: { userId: req.user.id }, orderBy: { dueDate: 'asc' }, take: 20 }),
      prisma.batch.findMany({ orderBy: { createdAt: 'desc' }, take: 20, include: { cropType: true, costs: true } }),
      prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    ]);

    // --- Trays ---
    const traySummary = trays.length
      ? trays.map(t => {
          const daysElapsed = Math.floor((now - new Date(t.plantedDate)) / 86400000);
          return `  - Regal ${t.regal + 1}, ${SHELF_LABEL(t.slot)}: ${t.cropKey}, posijano ${t.plantedDate} (${daysElapsed} dana)${t.notes ? ', napomena: ' + t.notes : ''}`;
        }).join('\n')
      : '  Nema aktivnih plitice';

    // --- Seeds ---
    const seedSummary = seeds.length
      ? seeds.map(s => `  - ${s.cropKey}: ${s.grams}g`).join('\n')
      : '  Nema podataka o zalihama';

    // --- Harvests ---
    const harvestSummary = harvests.length
      ? harvests.map(h => `  - ${h.cropName}: ${h.yieldG}g, datum: ${h.date}, Regal ${h.regal + 1} Polica ${h.shelf + 1} Plitice ${h.tray + 1}`).join('\n')
      : '  Nema zabilježenih berbi';

    // --- Sales ---
    const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
    const salesSummary = sales.length
      ? sales.map(s => {
          const customer = s.customer ? s.customer.name : 'nepoznat kupac';
          const items = s.items.map(i => `${i.cropName} ${i.quantityG}g × ${i.pricePerG}/g = ${i.subtotal.toFixed(2)}`).join(', ');
          return `  - ${new Date(s.date).toLocaleDateString('hr-HR')}, ${customer}: ${items} | ukupno: ${s.total.toFixed(2)}`;
        }).join('\n') + `\n  Ukupni prihod (zadnjih ${sales.length} prodaja): ${totalRevenue.toFixed(2)}`
      : '  Nema zabilježene prodaje';

    // --- Customers ---
    const customerSummary = customers.length
      ? customers.map(c => `  - ${c.name}${c.phone ? ', tel: ' + c.phone : ''}${c.notes ? ', napomena: ' + c.notes : ''}`).join('\n')
      : '  Nema kupaca';

    // --- Tasks ---
    const pendingTasks = tasks.filter(t => !t.completed);
    const completedTasks = tasks.filter(t => t.completed);
    const taskSummary = pendingTasks.length
      ? pendingTasks.map(t => `  - [${t.type}] ${t.title}, rok: ${new Date(t.dueDate).toLocaleDateString('hr-HR')}`).join('\n')
      : '  Nema zadataka';

    // --- Batches (old system) ---
    const batchSummary = batches.length
      ? batches.map(b => {
          const costs = b.costs.reduce((s, c) => s + c.amount, 0);
          return `  - ${b.cropType.name}, status: ${b.status}, posijano: ${new Date(b.sowDate).toLocaleDateString('hr-HR')}, troškovi: ${costs.toFixed(2)}${b.yieldGrams ? ', prinos: ' + b.yieldGrams + 'g' : ''}`;
        }).join('\n')
      : '  Nema serija';

    // --- Revenue by crop ---
    const revenuePerCrop = {};
    sales.forEach(s => s.items.forEach(i => {
      revenuePerCrop[i.cropName] = (revenuePerCrop[i.cropName] || 0) + i.subtotal;
    }));
    const revenueByCropSummary = Object.keys(revenuePerCrop).length
      ? Object.entries(revenuePerCrop).sort((a, b) => b[1] - a[1]).map(([k, v]) => `  - ${k}: ${v.toFixed(2)}`).join('\n')
      : '  Nema podataka';

    const systemPrompt = `Ti si AI asistent za ZGreens — malu farmu microgreens biljaka.
Pomažeš farmeru s analizom podataka, preporukama i uvidima o uzgoju.
Odgovaraj isključivo na hrvatskom jeziku. Budi sažet, konkretan i koristan.
Ne izmišljaj podatke — koristi samo podatke koji su ti dostupni ispod.
Danas je ${now.toLocaleDateString('hr-HR')}.

=== AKTIVNE PLITICE (${trays.length} ukupno) ===
${traySummary}

=== ZALIHE SJEMENA ===
${seedSummary}

=== BERBE (zadnjih ${harvests.length}) ===
${harvestSummary}

=== PRODAJA (zadnjih ${sales.length}) ===
${salesSummary}

=== PRIHOD PO USJEVU ===
${revenueByCropSummary}

=== KUPCI ===
${customerSummary}

=== ZADACI (${pendingTasks.length} aktivnih, ${completedTasks.length} završenih) ===
${taskSummary}

=== SERIJE — stari sustav (${batches.length}) ===
${batchSummary}`;

    const messages = [
      ...history.map(m => ({ role: m.role, content: m.text })),
      { role: 'user', content: message },
    ];

    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    res.json({ reply: response.choices[0].message.content });
  } catch (err) {
    console.error('AI route error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
