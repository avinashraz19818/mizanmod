#!/usr/bin/env node
// Change admin password via CLI - updates DB and .env
// Usage: node scripts/change-admin-password.js "NewPassword123" [newUsername]

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const newPassword = process.argv[2];
const newUsername = process.argv[3] || '';

if (!newPassword) {
  console.log('Usage: node scripts/change-admin-password.js "NewPassword" [newUsername]');
  console.log('Example: node scripts/change-admin-password.js "Mizan@123" admin');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('Error: Password must be at least 8 characters');
  process.exit(1);
}

(async () => {
  const BCRYPT_ROUNDS = 12;
  const hash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
  console.log('Generated hash:', hash);

  // Update DB
  try {
    const dbPath1 = path.join(__dirname, '..', 'database', 'mizanmod.db');
    const dbPath2 = path.join(__dirname, '..', 'database', 'apkbuilder.db');
    const dbFile = fs.existsSync(dbPath1) ? dbPath1 : dbPath2;
    if (fs.existsSync(dbFile)) {
      const Database = require('better-sqlite3');
      const db = new Database(dbFile);
      db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('admin_password_hash', hash);
      if (newUsername) {
        db.prepare('INSERT OR REPLACE INTO settings(key,value) VALUES(?,?)').run('admin_username', newUsername);
      }
      console.log('✅ DB updated:', dbFile);
      db.close();
    } else {
      console.warn('DB file not found, skipping DB update');
    }
  } catch (e) {
    console.error('DB update failed:', e.message);
  }

  // Update .env files
  const envPaths = [
    path.join(__dirname, '..', '.env'),
    '/root/mizan/.env',
    '/opt/mizanmod-full/.env',
    '/opt/mizanmods/.env',
    path.join(process.env.HOME || '/root', 'mizan/.env')
  ];

  for (const envPath of envPaths) {
    try {
      if (fs.existsSync(envPath)) {
        let content = fs.readFileSync(envPath, 'utf8');
        // Update ADMIN_USERNAME if provided
        if (newUsername) {
          if (/^ADMIN_USERNAME=.*$/m.test(content)) {
            content = content.replace(/^ADMIN_USERNAME=.*$/m, `ADMIN_USERNAME="${newUsername}"`);
          } else {
            content += `\nADMIN_USERNAME="${newUsername}"\n`;
          }
        }
        // Update ADMIN_PASSWORD_HASH - use single quotes to preserve $ 
        if (/^ADMIN_PASSWORD_HASH=.*$/m.test(content)) {
          content = content.replace(/^ADMIN_PASSWORD_HASH=.*$/m, `ADMIN_PASSWORD_HASH='${hash}'`);
        } else {
          content += `\nADMIN_PASSWORD_HASH='${hash}'\n`;
        }
        fs.writeFileSync(envPath, content, 'utf8');
        console.log('✅ .env updated:', envPath);
      }
    } catch (e) {
      console.error('Failed to update', envPath, e.message);
    }
  }

  // Update process.env for immediate effect if running
  process.env.ADMIN_PASSWORD_HASH = hash;
  if (newUsername) process.env.ADMIN_USERNAME = newUsername;

  console.log('\n✅ Admin password changed successfully!');
  console.log('Username:', newUsername || '(kept same)');
  console.log('New Password:', newPassword);
  console.log('\nNow restart: pm2 restart mizanmod --update-env');
})();
