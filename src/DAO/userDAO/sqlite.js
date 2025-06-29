const sqlite3 = require('sqlite3');
const path = require('path');
require('dotenv').config();

const dbPath = path.resolve(process.env.DB_PATH || './db.sqlite');

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Erreur de connexion à SQLite:", err.message);
        process.exit(1);
    } else {
        console.log(`Connecté à SQLite via ${dbPath}`);
    }
});

// Création de la table à l'init
db.serialize(() => {
    db.run(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      refresh_token TEXT
    )
  `);
});

// Préparer les requêtes
const insertOrUpdateStmt = db.prepare(`
  INSERT INTO users (username, refresh_token)
  VALUES (?, ?)
  ON CONFLICT(username) DO UPDATE SET refresh_token = excluded.refresh_token
`);

const selectStmt = db.prepare(`
  SELECT refresh_token FROM users WHERE username = ?
`);

const deleteStmt = db.prepare(`
  DELETE FROM users WHERE username = ?
`);

const saveRefreshToken = (username, refreshToken) => {
    return new Promise((resolve, reject) => {
        insertOrUpdateStmt.run(username, refreshToken, function (err) {
            if (err) return reject(err);
            resolve();
        });
    });
};

const getRefreshToken = (username) => {
    return new Promise((resolve, reject) => {
        selectStmt.get(username, (err, row) => {
            if (err) return reject(err);
            resolve(row ? row.refresh_token : null);
        });
    });
};

const deleteUser = (username) => {
    return new Promise((resolve, reject) => {
        deleteStmt.run(username, (err) => {
            if (err) return reject(err);
            resolve();
        });
    });
};

const getAllUsers = () => {
    return new Promise((resolve, reject) => {
        const sql = `SELECT username, refresh_token FROM users`;
        db.all(sql, [], (err, rows) => {
            if (err) return reject(err);
            resolve(rows);
        });
    });
};



// on ferme les statements à l'arrêt
process.on('exit', () => {
    insertOrUpdateStmt.finalize();
    selectStmt.finalize();
    deleteStmt.finalize();
});

module.exports = {
    saveRefreshToken,
    getRefreshToken,
    deleteUser,
    getAllUsers
};
