const { ObjectId } = require('mongodb');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const mime = require('mime-types');
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const fileQueue = require('../worker');

class FilesController {
  /**
   * Handles the POST request for uploading a file.
   *
   * @param {Object} req - The request object.
   * @param {Object} res - The response object.
   * @returns {Promise<void>} - A promise that resolves when the response is sent.
   */
  static async postUpload(req, res) {
    // Extract the token from the request headers
    const token = req.headers['x-token'];

    // If the token is missing, return an unauthorized error
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Generate the key for authentication
    const key = `auth_${token}`;

    // Get the user ID from Redis
    const userId = await redisClient.get(key);

    // If the user ID is missing, return an unauthorized error
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Destructure the request body
    const {
      name, type, parentId = '0', isPublic = false, data,
    } = req.body;

    // If the name is missing, return a bad request error
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    // If the type is missing or not valid, return a bad request error
    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    // If the type is not 'folder' and the data is missing, return a bad request error
    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    let parentFile = null;

    try {
      // If the parent ID is not '0', find the parent file in the database
      if (parentId !== '0') {
        parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });

        // If the parent file is not found, return a bad request error
        if (!parentFile) {
          return res.status(400).json({ error: 'Parent not found' });
        }

        // If the parent file is not a folder, return a bad request error
        if (parentFile.type !== 'folder') {
          return res.status(400).json({ error: 'Parent is not a folder' });
        }
      }
    } catch (err) {
      console.error('Error finding parent file:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }

    // Create a new file object
    const newFile = {
      userId: ObjectId(userId), // Store the user ID as an ObjectId
      name,
      type,
      isPublic,
      parentId: parentId === '0' ? '0' : ObjectId(parentId), // Store the parent ID as a string '0' or ObjectId
    };

    if (type === 'folder') {
      try {
        // Insert the new folder into the database and return the inserted document
        const response = await dbClient.db.collection('files').insertOne(newFile);
        return res.status(201).json(response.ops[0]);
      } catch (err) {
        console.error('Error creating folder:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    } else {
      // Get the folder path from the environment variables or use a default path
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';

      // Create the folder if it doesn't exist
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      // Generate a unique ID for the file
      const fileId = uuidv4();

      // Generate the local path for the file
      const localPath = path.join(folderPath, fileId);

      // Convert the data from base64 to a Buffer
      const fileData = Buffer.from(data, 'base64');

      try {
        // Write the file data to the local path
        await fs.promises.writeFile(localPath, fileData);

        // Add the local path to the file object
        newFile.localPath = localPath;

        // Insert the new file into the database and return the inserted document
        const response = await dbClient.db.collection('files').insertOne(newFile);

        // If the type is 'image', add the file to the processing queue
        if (type === 'image') {
          fileQueue.add({
            userId: userId.toString(),
            fileId: response.insertedId.toString(),
          });
        }

        return res.status(201).json(response.ops[0]);
      } catch (err) {
        console.error('Error creating file:', err);
        return res.status(500).json({ error: 'Internal server error' });
      }
    }
  }

  static async getShow(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    if (!ObjectId.isValid(fileId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    return res.status(200).json(file);
  }

  static async getIndex(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const parentId = req.query.parentId || 0;
    const page = parseInt(req.query.page, 10) || 0;
    const pageSize = 20;

    const match = { userId: ObjectId(userId) };
    if (parentId !== 0) {
      match.parentId = ObjectId(parentId);
    } else {
      match.parentId = 0;
    }

    try {
      const files = await dbClient.db.collection('files')
        .aggregate([
          { $match: match },
          { $skip: page * pageSize },
          { $limit: pageSize },
        ])
        .toArray();
      return res.status(200).json(files);
    } catch (err) {
      console.error('Error getting files:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  static async putPublish(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;
    // console.log(fileId);
    if (!fileId) {
      return res.status(404).json({ error: 'Not found !fieldId' });
    }

    try {
      await dbClient.db.collection('files').updateOne(
        { _id: ObjectId(fileId), userId: ObjectId(userId) },
        { $set: { isPublic: true } },
      );

      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

      return res.status(200).json(file);
    } catch (err) {
      console.error('Error publishing file:', err);
      return res.status(500).json({ error: 'Internal server Error' });
    }
  }

  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;

    if (!fileId) {
      return res.status(404).json({ error: 'Not found' });
    }

    try {
      await dbClient.db.collection('files').updateOne(
        { _id: ObjectId(fileId), userId: ObjectId(userId) },
        { $set: { isPublic: false } },
      );

      const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

      return res.status(200).json(file);
    } catch (err) {
      console.error('Error publishing file:', err);
      return res.status(500).json({ error: 'Internal server Error' });
    }
  }

  static async getFile(req, res) {
    const token = req.headers['x-token'];

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const key = `auth_${token}`;
    const userId = await redisClient.get(key);

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const fileId = req.params.id;

    if (!ObjectId.isValid(fileId)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

    if (!file || !file.isPublic) {
      return res.status(404).json({ error: 'Not found' });
    }

    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    if (!fs.existsSync(file.localPath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    const mimeType = mime.lookup(file.name);

    if (!mimeType) {
      return res.status(500).json({ error: 'Could not determine MIME type' });
    }

    try {
      const fileContent = await fs.promises.readFile(file.localPath);
      res.setHeader('Content-Type', mimeType);
      return res.send(fileContent);
    } catch (err) {
      console.error('Error reading file:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = FilesController;
