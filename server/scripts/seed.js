import { hashPassword } from '../lib/auth.js';
import { createUser, getUserByEmail, closeDb } from '../lib/db.js';

const ADMIN_EMAIL = 'admin@ukulotrade.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Admin';

function seed() {
  const existing = getUserByEmail(ADMIN_EMAIL);
  if (existing) {
    console.log('Admin user already exists:', ADMIN_EMAIL);
    closeDb();
    return;
  }

  const passwordHash = hashPassword(ADMIN_PASSWORD);
  const user = createUser({ email: ADMIN_EMAIL, passwordHash, name: ADMIN_NAME });
  console.log('Admin user created:', user.id, user.email);
  console.log('Default password:', ADMIN_PASSWORD);
  console.log('CHANGE THIS PASSWORD IN PRODUCTION!');

  closeDb();
}

seed();
