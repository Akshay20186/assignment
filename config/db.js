const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',        // your postgres username
    host: 'localhost',
    database: 'notesdb',     // your database name
    password: 'Akshay12@',
    port: 5432,
});

// Optional: test connection
pool.connect()
    .then(() => console.log("✅ PostgreSQL connected"))
    .catch(err => console.error("❌ DB connection error:", err.message));

module.exports = pool;