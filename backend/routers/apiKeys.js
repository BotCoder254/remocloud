const express = require('express');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const { pool } = require('../models/database');
const { authenticateUser, authenticateApiKey } = require('../middleware/auth');

const router = express.Router();

// Get all API keys for user
router.get('/', authenticateUser, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, scopes, created_at, last_used_at, revoked_at FROM api_keys WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.userId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

// Create new API key
router.post('/', authenticateUser, async (req, res) => {
  try {
    const { name, scopes = ['read', 'write'] } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'API key name required' });
    }

    const rawKey = `rk_${uuidv4().replace(/-/g, '')}`;
    const keyHash = await bcrypt.hash(rawKey, 12);

    const result = await pool.query(
      'INSERT INTO api_keys (user_id, key_hash, name, scopes) VALUES ($1, $2, $3, $4) RETURNING id, name, scopes, created_at',
      [req.user.userId, keyHash, name, scopes]
    );

    const apiKey = result.rows[0];
    
    res.status(201).json({
      ...apiKey,
      key: rawKey // Only returned once
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to create API key' });
  }
});

// Revoke API key
router.delete('/:keyId', authenticateUser, async (req, res) => {
  try {
    const { keyId } = req.params;
    
    const result = await pool.query(
      'UPDATE api_keys SET revoked_at = CURRENT_TIMESTAMP WHERE id = $1 AND user_id = $2 RETURNING id',
      [keyId, req.user.userId]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'API key not found' });
    }

    res.json({ message: 'API key revoked successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to revoke API key' });
  }
});

module.exports = router;