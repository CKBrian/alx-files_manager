// nside the folder controllers, create a file AppController.js that contains the definition of the 2 endpoints:

// GET /status should return if Redis is alive and if the DB is alive too by using the 2 utils created previously: { "redis": true, "db": true } with a status code 200
// GET /stats should return the number of users and files in DB: { "users": 12, "files": 1231 } with a status code 200
// users collection must be used for counting all users
// files collection must be used for counting all files

const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class AppController {
    static getStatus(req, res) {
        res.status(200).json({
            redis: redisClient.isAlive(),
            db: dbClient.isAlive()
        });
    }

    static async getStats(req, res) {
        const users = await dbClient.nbUsers();
        const files = await dbClient.nbFiles();
        res.status(200).json({ users, files });
    }
}

module.exports = AppController;