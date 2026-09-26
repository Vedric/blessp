const path = require('node:path');
const sharp = require('sharp');

// Keep the original photo for sharing and as the fallback image. Only the
// display format changes; dimensions and composition stay the same.
const directory = path.resolve(__dirname, '../client/public/img');
sharp(path.join(directory, 'blessp_story.jpeg'))
  .webp({ quality: 82, effort: 6 })
  .toFile(path.join(directory, 'blessp_story-cover.webp'))
  .then(info => process.stdout.write(`${JSON.stringify(info)}\n`))
  .catch(error => { console.error(error); process.exitCode = 1; });
