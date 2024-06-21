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
  console.log('Worker started...');
  const { fileId, userId } = job.data;

  if (!fileId || !userId) {
    const missingParam = !fileId ? 'fileId' : 'userId';
    console.error(`Missing ${missingParam}`);
    done(new Error(`Missing ${missingParam}`));
    return;
  }

  try {
    const file = await dbClient.db.collection('files').findOne({
      _id: ObjectId(fileId),
      userId: ObjectId(userId),
    });

    if (!file) {
      console.error('File not found');
      done(new Error('File not found'));
      return;
    }

    const sizes = [500, 250, 100];
    const filePath = file.localPath;
    const fileDir = path.dirname(filePath);
    const fileName = path.basename(filePath);

    for (const size of sizes) {
      try {
        const thumbnail = await imageThumbnail(filePath, { width: size });
        const thumbnailPath = path.join(fileDir, `${fileName}_${size}`);
        fs.writeFileSync(thumbnailPath, thumbnail);
      } catch (error) {
        console.error(`Error generating thumbnail for size ${size}:`, error);
        done(new Error(`Error generating thumbnail for size ${size}`));
        return;
      }
    }

    console.log('Thumbnails generated successfully');
    done();
  } catch (error) {
    console.error('Error processing job:', error);
    done(new Error('Error processing job'));
  }
});

module.exports = fileQueue;
