const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const Groq = require('groq-sdk');
const auth = require('../middleware/auth');

const prisma = new PrismaClient();

router.post('/chat', auth, async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY nije postavljen na serveru.' });
  }

  const { message, history = [] } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Poruka je obavezna.' });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    // Gather live farm data
    const [trays, seeds, harvests, sales] = await Promise.all([
      prisma.traySlot.findMany(),
      prisma.seedStorage.findMany(),
      prisma.harvest.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.sale.findMany({ orderBy: { date: 'desc' }, take: 10, include: { items: true } }),
    ]);

    // Summarise trays by crop
    const traysByCrop = {};
    trays.forEach(t => { traysByCrop[t.cropKey] = (traysByCrop[t.cropKey] || 0) + 1; });
    const traySummary = Object.keys(traysByCrop).length
      ? Object.entries(traysByCrop).map(([k, n]) => `  - ${k}: ${n} plitice`).join('\n')
      : '  Nema aktivnih plitice';

    const seedSummary = seeds.length
      ? seeds.map(s => `  - ${s.cropKey}: ${s.grams}g`).join('\n')
      : '  Nema podataka o zalihama';

    const harvestSummary = harvests.length
      ? harvests.slice(0, 10).map(h => `  - ${h.cropName}: ${h.yieldG}g (${h.date})`).join('\n')
      : '  Nema zabilježenih berbi';

    const totalRevenue = sales.reduce((s, sale) => s + sale.total, 0);
    const salesSummary = sales.length
      ? `  Zadnjih ${sales.length} prodaja, ukupni prihod: $${totalRevenue.toFixed(2)}`
      : '  Nema zabilježene prodaje';

    const systemPrompt = `Ti si AI asistent za ZGreens — malu farmu microgreens biljaka.
Pomažeš farmeru s analizom podataka, preporukama i uvidima o uzgoju.
Odgovaraj isključivo na hrvatskom jeziku. Budi sažet, konkretan i koristan.
Ne izmišljaj podatke — koristi samo podatke koji su ti dostupni ispod.

TRENUTNI PODACI FARME (${new Date().toLocaleDateString('hr-HR')}):

Aktivne plitice po vrsti usjeva:
${traySummary}
Ukupno: ${trays.length} plitice u 4 regala

Zalihe sjemena:
${seedSummary}

Zadnjih 10 berbi:
${harvestSummary}

Prodaja:
${salesSummary}`;

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
