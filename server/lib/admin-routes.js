import { Router } from 'express';
import { adminMiddleware, hashPassword } from './auth.js';
import { getAllUsers, getAllUsersWithStats, createUser, deleteUser, getUserById, getUserByEmail, updateUser, updateUserPassword, getUserWithStats, getTrades } from './db.js';


const router = Router();
router.use(adminMiddleware);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

router.get('/api/admin/users', async (req, res) => {
  res.json(await getAllUsersWithStats());
});

router.post('/api/admin/users', async (req, res) => {
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
    res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role, status: user.status });
  } catch (e) {
    console.error('[Admin] Create user error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.patch('/api/admin/users/:id/status', async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Nao e possivel alterar seu proprio status' });
    }
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const { status } = req.body;
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'Status invalido. Use: active ou suspended' });
    }
    await updateUser(req.params.id, { status });
    res.json({ ok: true, status });
  } catch (e) {
    console.error('[Admin] Update status error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.patch('/api/admin/users/:id/role', async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Nao e possivel alterar seu proprio papel' });
    }
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Papel invalido. Use: user ou admin' });
    }
    await updateUser(req.params.id, { role });
    res.json({ ok: true, role });
  } catch (e) {
    console.error('[Admin] Update role error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/api/admin/stats', async (req, res) => {
  try {
    const users = await getAllUsers();
    const totalUsers = users.length;
    const activeUsers = users.filter(u => u.status === 'active').length;
    const suspendedUsers = users.filter(u => u.status === 'suspended').length;
    const admins = users.filter(u => u.role === 'admin').length;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const newThisWeek = users.filter(u => u.created_at >= weekAgo).length;
    const newThisMonth = users.filter(u => u.created_at >= monthAgo).length;

    let totalTrades = 0;
    let totalProfit = 0;
    for (const u of users) {
      const trades = await getTrades(u.id, 10000);
      totalTrades += trades.length;
      totalProfit += trades.reduce((sum, t) => sum + (t.profit || 0), 0);
    }

    res.json({
      totalUsers, activeUsers, suspendedUsers, admins,
      newThisWeek, newThisMonth,
      totalTrades, totalProfit: totalProfit.toFixed(2),
    });
  } catch (e) {
    console.error('[Admin] Stats error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.delete('/api/admin/users/:id', async (req, res) => {
  try {
    if (req.params.id === req.userId) {
      return res.status(400).json({ error: 'Nao e possivel excluir seu proprio usuario' });
    }
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    await deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    console.error('[Admin] Delete user error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/api/admin/users/:id', async (req, res) => {
  try {
    const user = await getUserWithStats(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    res.json(user);
  } catch (e) {
    console.error('[Admin] Get user error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/api/admin/users/:id', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const { name, email } = req.body;
    const updates = {};
    if (name && name.trim()) updates.name = name.trim();
    if (email && email.trim()) {
      const normalizedEmail = email.toLowerCase().trim();
      if (!EMAIL_REGEX.test(normalizedEmail)) {
        return res.status(400).json({ error: 'Email invalido' });
      }
      const existing = await getUserByEmail(normalizedEmail);
      if (existing && existing.id !== req.params.id) {
        return res.status(409).json({ error: 'Email ja cadastrado' });
      }
      updates.email = normalizedEmail;
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'Nenhum dado para atualizar' });
    }
    const updated = await updateUser(req.params.id, updates);
    res.json({ ok: true, user: { id: updated.id, email: updated.email, name: updated.name, role: updated.role, status: updated.status } });
  } catch (e) {
    console.error('[Admin] Update user error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.put('/api/admin/users/:id/password', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter no minimo 6 caracteres' });
    }
    const passwordHash = hashPassword(newPassword);
    await updateUserPassword(req.params.id, passwordHash);
    res.json({ ok: true, message: 'Senha resetada com sucesso' });
  } catch (e) {
    console.error('[Admin] Reset password error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

router.get('/api/admin/users/:id/trades', async (req, res) => {
  try {
    const user = await getUserById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario nao encontrado' });
    }
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const trades = await getTrades(req.params.id, limit);
    res.json(trades);
  } catch (e) {
    console.error('[Admin] Get user trades error:', e.message);
    res.status(500).json({ error: 'Erro interno' });
  }
});

export default router;
