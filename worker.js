/*
By using the module Bull, create a queue fileQueue
Process this queue:
If fileId is not present in the job, raise an error Missing fileId
If userId is not present in the job, raise an error Missing userId
If no document is found in DB based on the fileId and userId, raise an error File not found
By using the module image-thumbnail, generate 3 thumbnails with width = 500, 250 and 100 - store each result on the same location of the original file by appending _<width size>
*/

const Bull = require('bull');
const imageThumbnail = require('image-thumbnail');
const path = require('path')
const { ObjectId } = require('mongodb');
const dbClient = require('./utils/db');
const fs = require('fs');


const fileQueue = new Bull('fileQueue', {
    redis: {
        port: 6379,
        host: '127.0.0.1'
    }
});

fileQueue.process(async (job, done) => {
    console.log('Woker started...');
    const { fileId, userId } = job.data;

    if (!fileId) {
        return resizeBy.status(400).json({ error: 'Missing fileId' });
    }

    if (!userId) {
        return res.status(400).json({ error: 'Missing userId' });
    }

    const file = dbClient.db.collection('files').findOne({ _id: ObjectId(fileId), userId: ObjectId(userId) });
    

    if(!file) {
        return res.status(404).json({ error: 'File not found' });
    }

    const sizes = [500, 250, 100];
    const filePath = file.localPath;
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);
    try {
        for (const size of sizes) {
            const thumbnail = await imageThumbnail(filePath, { width: size });
            const thumbnailPath = path.join(fileDir, `${fileName}_${size}`);
            fs.writeFileSync(thumbnailPath, thumbnail);
        };
        console.log('Thumbnails generated Successfully');
    } catch (error) {
        console.error('Error generating Thumbnails:', error)
    }
});

module.exports = fileQueue;
