const Bull = require('bull');
const imageThumbnail = require('image-thumbnail');
const path = require('path');
const { ObjectId } = require('mongodb');
const fs = require('fs');
const dbClient = require('./utils/db');

const fileQueue = new Bull('fileQueue', {
  redis: {
    port: 6379,
    host: '127.0.0.1',
  },
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

  if (!file) {
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
    }
    console.log('Thumbnails generated Successfully');
  } catch (error) {
    console.error('Error generating Thumbnails:', error);
  }
});

module.exports = fileQueue;
