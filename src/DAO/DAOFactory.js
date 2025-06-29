require('dotenv').config();

function getUserDAO() {
    const daoType = process.env.USER_DAO || 'sqlite';
    try {
        return require(`./userDAO/${daoType}.js`);
    } catch (err) {
        console.error(`DAO "${daoType}" introuvable :`, err.message);
        return require('./userDAO/sqlite.js')
    }
}

module.exports = {
    getUserDAO
};
