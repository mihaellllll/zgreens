const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const { PrismaClient } = require('@prisma/client');
const authMiddleware = require('../middleware/auth');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'zgreens-secret-key';

router.post('/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password || !name)
      return res.status(400).json({ error: 'Sva polja su obavezna' });

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return res.status(409).json({ error: 'Email je već u upotrebi' });

    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, password: hashed, name } });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '1y' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Greška na serveru: ' + err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(401).json({ error: 'Pogrešni podaci za prijavu' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Pogrešni podaci za prijavu' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '1y' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Greška na serveru: ' + err.message });
  }
});

// Always respond 200 to prevent email enumeration; email sending is fire-and-forget
router.post('/forgot-password', async (req, res) => {
  res.json({ message: 'Ako email postoji, poslali smo link za reset lozinke.' });

  try {
    const { email } = req.body;
    if (!email) return;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const token = crypto.randomBytes(32).toString('hex');
    const expiry = new Date(Date.now() + 60 * 60 * 1000); // 1 sat

    await prisma.user.update({
      where: { email },
      data: { resetToken: token, resetTokenExpiry: expiry },
    });

    if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn(`[ZGreens] SMTP nije konfiguriran. Reset link: ${process.env.FRONTEND_URL || 'http://localhost:3001'}/login?token=${token}`);
      return;
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    const resetLink = `${frontendUrl}/login?token=${token}`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: email,
      subject: 'ZGreens — Reset lozinke',
      html: `
        <h2>Reset lozinke</h2>
        <p>Kliknite na link za reset lozinke (vrijedi 1 sat):</p>
        <p><a href="${resetLink}">${resetLink}</a></p>
        <p>Ako niste tražili reset lozinke, zanemarite ovaj email.</p>
      `,
    });
  } catch (err) {
    console.error('Forgot password background error:', err);
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    if (!token || !newPassword)
      return res.status(400).json({ error: 'Token i nova lozinka su obavezni.' });

    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: { gt: new Date() },
      },
    });

    if (!user)
      return res.status(400).json({ error: 'Token je nevažeći ili je istekao.' });

    const hashed = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashed, resetToken: null, resetTokenExpiry: null },
    });

    res.json({ message: 'Lozinka uspješno promijenjena.' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Greška na serveru: ' + err.message });
  }
});

// Auto-login: returns JWT for the single local user (no password needed)
router.get('/auto-login', async (req, res) => {
  try {
    const user = await prisma.user.findFirst();
    if (!user) return res.status(404).json({ error: 'Nema korisnika' });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '1y' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Auto-login error:', err);
    res.status(500).json({ error: 'Greška na serveru: ' + err.message });
  }
});

// First-run setup: create the single local user with only a name
router.post('/setup', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Ime je obavezno' });

    const existing = await prisma.user.findFirst();
    if (existing) {
      // Already set up — just return auto-login token
      const token = jwt.sign({ id: existing.id, email: existing.email, name: existing.name }, JWT_SECRET, { expiresIn: '1y' });
      return res.json({ token, user: { id: existing.id, email: existing.email, name: existing.name } });
    }

    const randomPassword = require('crypto').randomBytes(32).toString('hex');
    const hashed = await bcrypt.hash(randomPassword, 10);
    const user = await prisma.user.create({
      data: { email: 'user@local', password: hashed, name: name.trim() },
    });

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '1y' });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (err) {
    console.error('Setup error:', err);
    res.status(500).json({ error: 'Greška na serveru: ' + err.message });
  }
});

// GET /api/auth/me — returns current user info + hasGroqKey (never returns the key itself)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!user) return res.status(404).json({ error: 'Korisnik ne postoji' });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      hasGroqKey: !!user.groqApiKey,
    });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Greška na serveru: ' + err.message });
  }
});

// PATCH /api/auth/settings — saves groqApiKey and/or name
router.patch('/settings', authMiddleware, async (req, res) => {
  try {
    const { groqApiKey, name } = req.body;
    const data = {};
    if (typeof groqApiKey === 'string') data.groqApiKey = groqApiKey.trim() || null;
    if (typeof name === 'string' && name.trim()) data.name = name.trim();

    if (Object.keys(data).length === 0)
      return res.status(400).json({ error: 'Nema podataka za ažuriranje.' });

    const user = await prisma.user.update({ where: { id: req.user.id }, data });
    res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      hasGroqKey: !!user.groqApiKey,
    });
  } catch (err) {
    console.error('Settings error:', err);
    res.status(500).json({ error: 'Greška na serveru: ' + err.message });
  }
});

module.exports = router;
