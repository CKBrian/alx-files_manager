const { MongoClient } = require('mongodb');
require('dotenv').config();

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}`;

    this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });
    this.db = null;
    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
      })
      .catch((err) => {
        console.error('Failed to connect to MongoDB:', err);
      });
  }

  isAlive() {
    // Returns true when connection to MongoD is  success otherwise false
    return this.client && this.client.isConnected() && this.db;
  }

  async nbUsers() {
    // Returns number of documents in collection users, otherwise returns 0 incase of an error
    try {
      return await this.db.collection('users').countDocuments();
    } catch (err) {
      console.error('Error counting users:', err);
      return 0;
    }
  }

  async nbFiles() {
    // returns number of documents in collection files, otherwise 0 incase of an error
    try {
      return await this.db.collection('files').countDocuments();
    } catch (err) {
      console.error('Error counting Files:', err);
      return 0;
    }
  }
}

const dbClient = new DBClient();
module.exports = dbClient;
