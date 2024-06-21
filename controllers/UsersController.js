const { ObjectId } = require('mongodb');
const sha1 = require('sha1');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');

class UsersController {
  static async postNew(req, res) {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    /* Connect to client and check if user exists */
    try {
      if (!dbClient.isAlive()) {
        console.error('Db not connected');
        return res.status(500).json({ error: 'Internal dbClient Server Error' });
      }

      await dbClient.connect();
      const userExists = await dbClient.db.collection('users').findOne({ email });

      if (userExists) {
        return res.status(400).json({ error: 'Already exist' });
      }
    } catch (error) {
      console.error('Error connecting to db:', error);
      return res.status(500).json({ error: 'Internal dbClient Server Error' });
    }

    /* hash password and store new user in db */
    const hashedPassword = sha1(password);

    const newUser = {
      email,
      password: hashedPassword,
    };

    try {
      const response = await dbClient.db.collection('users').insertOne(newUser);
      return res.status(201).json({ id: response.insertedId, email });
    } catch (err) {
      console.error('Error creating user:', err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  static async getMe(req, res) {
    const token = req.headers['x-token'];
    // console.log(req.headers);

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await dbClient.db.collection('users').findOne({ _id: ObjectId(userId) }, { projection: { email: 1 } });

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.status(200).json(user);
  }
}

module.exports = UsersController;
