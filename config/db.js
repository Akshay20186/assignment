const { Pool } = require('pg');

const pool = new Pool({
    user: 'postgres',       
    host: 'localhost',
    database: 'notesdb',     
    password: 'Akshay12@',
    port: 5432,
});

// Optional: test connection
pool.connect()
    .then(() => console.log("PostgreSQL connected"))
    .catch(err => console.error("DB connection error:", err.message));

module.exports = pool;
