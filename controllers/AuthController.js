/*
*/

const { v4: uuidv4 } = require('uuid');
const sha1 = require('sha1');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
    static async getConnect(req, res) {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return res.status(401).json({ error: 'Unauthorized '});
        }
    //using the header Authorization and the technique of the Basic auth (Base64 of the <email>:<password>), 
    //find the user associate to this email and with this password (reminder: we are storing the SHA1 of the password)
    //If no user has been found, return an error Unauthorized with a status code 401
        const base64Credentials = authHeader.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [email, password] = credentials.split(':');

        const hashedPassword = sha1(password);
        /*
        Create a key: auth_<token>
        Use this key for storing in Redis (by using the redisClient create previously) the user ID for 24 hours
        Return this token: { "token": "155342df-2399-41da-9e8c-458b6ac52a0c" } with a status code 200
        */
        const userExists = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

        if (!userExists) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const token = uuidv4();

        const key = `auth_${token}`;

        await redisClient.set(key, userExists._id.toString(), 86400);

        return res.status(200).json({ token });
    }

    static async getDisconnect(req, res) {
        /*
        Retrieve the user based on the token:
        If not found, return an error Unauthorized with a status code 401
        Otherwise, delete the token in Redis and return nothing with a status code 204
        */
        const token = req.headers['x-token'];

        if (!token) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const key = `auth_${token}`;

        const userId = await redisClient.get(key);

        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        await redisClient.del(key);
        return res.status(204).send();
    }
}

module.exports = AuthController;