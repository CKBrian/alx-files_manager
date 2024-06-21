const { v4: uuidv4 } = require('uuid');
const sha1 = require('sha1');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

class AuthController {
  static async getConnect(req, res) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract Base64 content
    const base64Credentials = authHeader.split(' ')[1];

    let credentials;
    try {
      // Decode Base64 content
      credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
    } catch (error) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const [email, password] = credentials.split(':');
    if (!email || !password) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const hashedPassword = sha1(password);

    try {
      const userExists = await dbClient.db.collection('users').findOne({ email, password: hashedPassword });

      if (!userExists) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const token = uuidv4();
      const key = `auth_${token}`;
      await redisClient.set(key, userExists._id.toString(), 86400);

      return res.status(200).json({ token });
    } catch (error) {
      console.error('Error while connecting:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getDisconnect(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;

    try {
      const userId = await redisClient.get(key);

      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      await redisClient.del(key);
      return res.status(204).send();
    } catch (error) {
      console.error('Error while disconnecting:', error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

module.exports = AuthController;
