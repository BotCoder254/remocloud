const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { pool } = require('../models/database');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Authenticate user with JWT token
const authenticateUser = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
};

// Authenticate API key
const authenticateApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers.authorization?.replace('Bearer ', '');
    
    if (!apiKey || !apiKey.startsWith('rk_')) {
      return res.status(401).json({ error: 'Invalid API key format' });
    }

    const result = await pool.query(
      'SELECT ak.*, u.id as user_id FROM api_keys ak JOIN users u ON ak.user_id = u.id WHERE ak.revoked_at IS NULL'
    );

    let validKey = null;
    for (const key of result.rows) {
      if (await bcrypt.compare(apiKey, key.key_hash)) {
        validKey = key;
        break;
      }
    }

    if (!validKey) {
      return res.status(401).json({ error: 'Invalid API key' });
    }

    // Update last used timestamp
    await pool.query('UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1', [validKey.id]);

    req.user = { userId: validKey.user_id };
    req.apiKey = validKey;
    next();
  } catch (error) {
    res.status(401).json({ error: 'API key authentication failed' });
  }
};

module.exports = { authenticateUser, authenticateApiKey };