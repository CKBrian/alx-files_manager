const { MongoClient } = require('mongodb');

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';

    const url = `mongodb://${host}:${port}/${database}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.client.connect();
  }

  isAlive() {
    return this.client.isConnected();
  }

  async nbUsers() {
    const count = await this.client.db().collection('users').countDocuments();
    return count;
  }

  async nbFiles() {
    const count = await this.client.db().collection('files').countDocuments();
    return count;
  }
}

const dbClient = new DBClient();
console.log(dbClient.isAlive());
module.exports = dbClient;
