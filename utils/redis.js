const redis = require('redis');
const util = require('util');

class RedisClient {
  constructor() {
    this.client = redis.createClient();
    this.client.on('error', (err) => {
      console.log(`Redis client not connected to the server: ${err}`);
    });
    this.client.on('connect', () => {
      console.log('Redis client connected to the server');
    });

    this.getAsync = util.promisify(this.client.get).bind(this.client);
    this.setAsync = util.promisify(this.client.set).bind(this.client);
    this.delAsync = util.promisify(this.client.del).bind(this.client);
  }

  isAlive() {
    // return this.client;
    return this.client.connected;
  }

  async get(key) {
    // converts a function to an async function
    // const getAsync = util.promisify(this.client.get).bind(this.client);

    // returns a stored value for the key in the redis server
    try {
      return await this.getAsync(key);
    } catch (err) {
      console.error('Error getting key from Redis:', err);
      return null;
    }
  }

  async set(key, value, time) {
    /* stores elements in the redis server */
    try {
      await this.setAsync(key, value, 'EX', time);
    } catch (err) {
      console.error('Error setting key in Redis:', err);
    }
  }

  async del(key) {
    /* Deletes a key in the redis server */
    try {
      await this.delAsync(key);
    } catch (err) {
      console.error('Error deleting key in Redis:', err);
    }
  }
}

const redisClient = new RedisClient();
module.exports = redisClient;
