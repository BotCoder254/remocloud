const { pool } = require('../models/database');

// Store file data in database
const storeFileData = async (client, fileBuffer, fileHash) => {
  const result = await client.query(`
    INSERT INTO file_data (file_hash, data) 
    VALUES ($1, $2) 
    ON CONFLICT (file_hash) DO NOTHING
    RETURNING id
  `, [fileHash, fileBuffer]);
  
  return fileHash;
};

// Retrieve file data from database
const getFileData = async (client, fileHash) => {
  const result = await client.query(`
    SELECT data FROM file_data WHERE file_hash = $1
  `, [fileHash]);
  
  if (!result.rows[0]) {
    throw new Error(`File data not found for hash: ${fileHash}`);
  }
  
  return result.rows[0].data;
};

// Delete file data from database
const deleteFileData = async (client, fileHash) => {
  await client.query(`
    DELETE FROM file_data WHERE file_hash = $1
  `, [fileHash]);
};

module.exports = { storeFileData, getFileData, deleteFileData };