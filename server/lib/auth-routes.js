import { Router } from 'express';
import { hashPassword, verifyPassword, generateToken, authMiddleware } from './auth.js';
import { getUserByEmail, createUser, getUserById, updateUser, updateUserPassword, getUserWithStats } from './db.js';

const router = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, senha e nome sao obrigatorios' });
    }
    if (!EMAIL_REGEX.test(email)) {
      return res.status(400).json({ error: 'Email invalido' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Senha deve ter no minimo 6 caracteres' });
    }

    const existing = await getUserByEmail(email.toLowerCase().trim());
    if (existing) {
      return res.status(409).json({ error: 'Email ja cadastrado' });
    }

    const passwordHash = hashPassword(password);
    const user = await createUser({ email: email.toLowerCase().trim(), passwordHash, name: name.trim() });
    const token = generateToken(user.id, user.role);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error('[Auth] Register error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha sao obrigatorios' });
    }

    const user = await getUserByEmail(email.toLowerCase().trim());
    if (!user || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Email ou senha incorretos' });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({ error: 'Conta suspensa. Contate o administrador.' });
    }

    await updateUser(user.id, { last_login: new Date().toISOString() });
    const token = generateToken(user.id, user.role);

    res.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (e) {
    console.error('[Auth] Login error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/api/auth/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    console.error('[Auth] Me error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/api/auth/profile', authMiddleware, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Nome e obrigatorio' });
    }
    const user = await updateUser(req.userId, { name: name.trim() });
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role });
  } catch (e) {
    console.error('[Auth] Profile error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/api/auth/password', authMiddleware, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Senha atual e nova senha sao obrigatorias' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter no minimo 6 caracteres' });
    }
    const user = await getUserById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }
    const passwordHash = hashPassword(newPassword);
    await updateUserPassword(req.userId, passwordHash);
    res.json({ ok: true, message: 'Senha alterada com sucesso' });
  } catch (e) {
    console.error('[Auth] Password change error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/api/auth/profile-stats', authMiddleware, async (req, res) => {
  try {
    const userWithStats = await getUserWithStats(req.userId);
    if (!userWithStats) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    res.json(userWithStats);
  } catch (e) {
    console.error('[Auth] Profile stats error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
