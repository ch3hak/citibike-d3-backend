const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'citibike_viz',
    password: process.env.DB_PASSWORD || '',
    port: process.env.DB_PORT || 5432,
    
    max: 10, 
    min: 2,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
    
    ...(process.env.NODE_ENV === 'development' && {
        log: (msg) => console.log(' DB:', msg)
    })
});

pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
    process.exit(-1);
});

async function testConnection() {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW()');
        console.log('Database connected successfully at', result.rows[0].now);
        client.release();
    } catch (err) {
        console.error('Database connection failed:', err.message);
        process.exit(1);
    }
}

module.exports = { pool, testConnection };