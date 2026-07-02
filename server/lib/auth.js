import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getUserById } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'ukulotrade-dev-secret';
const TOKEN_EXPIRY = '7d';

export function hashPassword(password) {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

export function generateToken(userId, role = 'user') {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
  req.userId = payload.userId;
  req.userRole = payload.role;
  next();
}

export async function adminMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token nao fornecido' });
  }
  const token = header.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    return res.status(401).json({ error: 'Token invalido ou expirado' });
  }
  const user = await getUserById(payload.userId);
  if (!user || user.role !== 'admin') {
    return res.status(403).json({ error: 'Acesso restrito a administradores' });
  }
  req.userId = payload.userId;
  req.userRole = 'admin';
  next();
}

export function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    const payload = verifyToken(header.slice(7));
    if (payload) req.userId = payload.userId;
  }
  next();
}
