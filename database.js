const fs = require('fs');
const path = require('path');

// JSON database file paths
const keysFile = path.join(__dirname, 'keys.json');
const usersFile = path.join(__dirname, 'users.json');

// Initialize database files if they don't exist
if (!fs.existsSync(keysFile)) {
  fs.writeFileSync(keysFile, JSON.stringify([], null, 2));
}
if (!fs.existsSync(usersFile)) {
  fs.writeFileSync(usersFile, JSON.stringify([], null, 2));
}

// Read/Write helpers
function readKeys() {
  return JSON.parse(fs.readFileSync(keysFile, 'utf8'));
}

function writeKeys(keys) {
  fs.writeFileSync(keysFile, JSON.stringify(keys, null, 2));
}

function readUsers() {
  return JSON.parse(fs.readFileSync(usersFile, 'utf8'));
}

function writeUsers(users) {
  fs.writeFileSync(usersFile, JSON.stringify(users, null, 2));
}

// Key Management
const keyDB = {
  // Generate a random key
  generateKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = 'REHABS-';
    for (let i = 0; i < 16; i++) {
      if (i > 0 && i % 4 === 0) key += '-';
      key += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return key;
  },

  // Create a new key
  createKey(duration) {
    const keys = readKeys();
    const key = this.generateKey();
    keys.push({
      key,
      duration,
      created_at: Date.now(),
      used: 0,
      used_by: null
    });
    writeKeys(keys);
    return key;
  },

  // Check if key exists and is valid
  validateKey(key) {
    const keys = readKeys();
    return keys.find(k => k.key === key && k.used === 0);
  },

  // Mark key as used
  useKey(key, discordId) {
    const keys = readKeys();
    const keyObj = keys.find(k => k.key === key);
    if (keyObj) {
      keyObj.used = 1;
      keyObj.used_by = discordId;
      writeKeys(keys);
    }
  },

  // Get key info
  getKey(key) {
    const keys = readKeys();
    return keys.find(k => k.key === key);
  }
};

// User Management
const userDB = {
  // Create a new user
  createUser(username, password, discordId, key) {
    const keyInfo = keyDB.validateKey(key);
    if (!keyInfo) {
      throw new Error('Invalid or already used key');
    }

    // Calculate expiry date
    const now = Date.now();
    let expiryDate;
    
    switch (keyInfo.duration) {
      case 'week':
        expiryDate = now + (7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        expiryDate = now + (30 * 24 * 60 * 60 * 1000);
        break;
      case 'lifetime':
        expiryDate = now + (100 * 365 * 24 * 60 * 60 * 1000); // 100 years
        break;
      default:
        throw new Error('Invalid key duration');
    }

    const users = readUsers();
    users.push({
      username,
      password,
      discord_id: discordId,
      key_used: key,
      expiry_date: expiryDate,
      created_at: now
    });
    writeUsers(users);
    keyDB.useKey(key, discordId);
    
    return { username, expiryDate };
  },

  // Get user by username
  getUser(username) {
    const users = readUsers();
    return users.find(u => u.username.toLowerCase() === username.toLowerCase());
  },

  // Get user by Discord ID
  getUserByDiscordId(discordId) {
    const users = readUsers();
    return users.find(u => u.discord_id === discordId);
  },

  // Authenticate user
  authenticate(username, password) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
    
    if (!user) return null;
    
    // Check if expired
    if (user.expiry_date < Date.now()) {
      return { expired: true, user };
    }
    
    return { expired: false, user };
  },

  // Check if username exists
  usernameExists(username) {
    const users = readUsers();
    return users.some(u => u.username.toLowerCase() === username.toLowerCase());
  },

  // Check if user already registered
  isDiscordIdRegistered(discordId) {
    const users = readUsers();
    return users.some(u => u.discord_id === discordId);
  },

  // Save user configs
  saveConfigs(username, configs) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user) {
      user.configs = configs;
      writeUsers(users);
      return true;
    }
    return false;
  },

  // Get user configs
  getConfigs(username) {
    const users = readUsers();
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    return user ? user.configs : null;
  }
};

module.exports = { keyDB, userDB };
