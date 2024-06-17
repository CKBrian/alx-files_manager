// create a file db.js that contains the class DBClient.

// DBClient should have:

// the constructor that creates a client to MongoDB:
// host: from the environment variable DB_HOST or default: localhost
// port: from the environment variable DB_PORT or default: 27017
// database: from the environment variable DB_DATABASE or default: files_manager
// a function isAlive that returns true when the connection to MongoDB is a success otherwise, false
// an asynchronous function nbUsers that returns the number of documents in the collection users
// an asynchronous function nbFiles that returns the number of documents in the collection files
// After the class definition, create and export an instance of DBClient called dbClient.

const { MongoClient } = require("mongodb");
require('dotenv').config();

class DBClient {
    constructor() {
        // Creates a client to MongoDB with host, port and database names from environment variables or otherwise default
        const host = process.env.DB_HOST || 'localhost';
        const port = process.env.DB_PORT || 27017;
        const database = process.env.DB_DATABASE || 'files_manager';

        const url = `mongodb://${host}:${port}`;

        this.client = new MongoClient(url, { useNewUrlParser: true, useUnifiedTopology: true });

        this.client.connect()
        .then(() => {
            this.db = this.client.db(database);
        })
        .catch((err) => {
            console.error("Failed to connect to MongoDB:", err)
        });
    }

    isAlive() {
        //Returns true when connection to MongoD is  success otherwise false
        return this.client && this.client.isConnected() && this.db !== undefined;
    }

    async nbUsers() {
        // Returns number of documents in collection users, otherwise returns 0 incase of an error
        try {
            return await this.db.collection('users').countDocuments();
        } catch (err) {
            console.error("Error counting users:", err);
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

const dbClient = new DBClient;
module.exports = dbClient; 