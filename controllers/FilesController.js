
const dbClient = require('../utils/db');
const redisClient = require('../utils/redis');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const path = require('path')
const mime = require('mime-types')
const fileQueue = require('../worker');

class FilesController {
    static async postUpload (req, res) {
        const token = req.headers['x-token'];

        if (!token) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const key = `auth_${token}`;
        const userId = await redisClient.get(key);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { name, type, parentId = 0, isPublic = false, data } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'Missing name' });
        }

        if (!type || !['folder', 'file', 'image'].includes(type)) {
            return res.status(400).json({ error: 'Missing type' });
        }

        if (type !== 'folder' && !data) {
            return res.status(400).json({ error: 'Missing data' });
        }

        let parentFile = null;

        if (parentId !== 0) {
            parentFile = await dbClient.db.collection('files').findOne({ _id: ObjectId(parentId) });

            if (!parentFile) {
                return res.status(400).json({ error: 'Parent not found' });
            }
            if (parentFile.type !== 'folder') {
                return res.status(400).json({ error: "Parent is not a folder" });
            }
        }

        const newFile = {
            userId: ObjectId(userId),
            name,
            type,
            isPublic,
            parentId: parentId === 0 ? 0 : ObjectId(parentId),
        };

        if (type === 'folder') {
            try {
                const response = await dbClient.db.collection('files').insertOne(newFile);
                return res.status(201).json(response.ops[0]);
            } catch(err) {
                console.error('Error creating folder:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
        } else {
            const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true});
            }

            const fileId = uuidv4();
            const localPath = path.join(folderPath, fileId);
            const fileData = Buffer.from(data, 'base64');

            try {
                await fs.promises.writeFile(localPath, fileData);
                newFile.localPath = localPath;
                const response = await dbClient.db.collection('files').insertOne(newFile);

                if (type === 'image') {
                    fileQueue.add({
                        userId: userId.toString(),
                        fileId: response.insertedId.toStr
                    });
                }
                
                return res.status(201).json(response.ops[0]);
            } catch (err) {
                console.error('Error creating file:', err);
                return res.status(500).json({ error: 'Internal server error' });
            }
        }
    }

    static async getShow (req, res) {
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
        if (!ObjectId.isValid(fieldId)) {
            return res.status(404).json({ error: 'Not found' });
        }

        const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });

        if (!file) {
            return res.status(404).json({ error: 'Not found' });
        }

        return res.status(200).json(file);
    }
    
    static async getIndex (req, res) {
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
                { $limit: pageSize }
            ])
            .toArray();
        return res.status(200).json(files);
        } catch (err) {
            console.error('Error getting files:', err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }
    static async putPublish (req, res) {
        /*
        set isPublic to true on the file document based on the ID:

        Retrieve the user based on the token:
        If not found, return an error Unauthorized with a status code 401
        If no file document is linked to the user and the ID passed as parameter, return an error Not found with a status code 404
        Otherwise:
        Update the value of isPublic to true
        And return the file document with a status code 200
        */
        const token = req.headers['x-token'];

        if (!token) {
            return res.status(401).json({ error: "Unauthorized" });
        }

        const key = `auth_${token}`;
        const userId = await redisClient.get(key);
        if (!userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const fileId = req.params.id;
        //console.log(fileId);
        if (!fileId) {
            return res.status(404).json({ error: 'Not found !fieldId' });
        }

        try {
            await dbClient.db.collection('files').updateOne(
                { _id: ObjectId(fileId), userId: ObjectId(userId) },
                { $set: { isPublic: true } }
            );

            const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
            
            return res.status(200).json(file);
        } catch (err) {
            console.error('Error publishing file:', err);
            return res.status(500).json({ error: 'Internal server Error' });
        };
    }
    
    static async putUnpublish (req, res) {
        /*set isPublic to false on the file document based on the ID:

        Retrieve the user based on the token:
        If not found, return an error Unauthorized with a status code 401
        If no file document is linked to the user and the ID passed as parameter, return an error Not found with a status code 404
        Otherwise:
        Update the value of isPublic to false
        And return the file document with a status code 200*/


        const token = req.headers['x-token'];

        if (!token) {
            return res.status(401).json({ error: "Unauthorized" });
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
                { $set: { isPublic: false } }
            );
            
            const file = await dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
            
            return res.status(200).json(file);
        } catch (err) {
            console.error('Error publishing file:', err);
            return res.status(500).json({ error: 'Internal server Error' });
            
        };
    }

    static async getFile (req, res) {
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

