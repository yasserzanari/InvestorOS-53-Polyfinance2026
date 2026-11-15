const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomUUID } = require('node:crypto');

function validatePng(data) {
  if (data.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error('Invalid PNG signature');
  const crc32 = bytes => {
    let crc = 0xffffffff;
    for (const byte of bytes) { crc ^= byte; for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    return (crc ^ 0xffffffff) >>> 0;
  };
  let end = false;
  for (let offset = 8; offset < data.length;) {
    const size = data.readUInt32BE(offset);
    if (offset + size + 12 > data.length) throw new Error('Incomplete PNG chunk');
    if (crc32(data.subarray(offset + 4, offset + 8 + size)) !== data.readUInt32BE(offset + 8 + size)) throw new Error('PNG CRC mismatch');
    end = data.subarray(offset + 4, offset + 8).toString() === 'IEND';
    offset += size + 12;
  }
  if (!end) throw new Error('Missing PNG end');
}
exports.capture = async function capture(page, prefix, options = {}) {
  let failure;
  for (let attempt = 0; attempt < 3; attempt++) {
    const output = path.join(os.tmpdir(), `${prefix}-${randomUUID()}.png`);
    const temporary = `${output}.tmp`;
    try {
      await page.screenshot({ path: temporary, type: 'png', ...options });
      const data = fs.readFileSync(temporary); validatePng(data);
      await page.evaluate(async encoded => {
        const response = await fetch(`data:image/png;base64,${encoded}`);
        const bitmap = await createImageBitmap(await response.blob());
        if (!bitmap.width || !bitmap.height) throw new Error('Empty PNG decode');
        bitmap.close();
      }, data.toString('base64'));
      fs.renameSync(temporary, output); return output;
    } catch (error) { failure = error; if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
  }
  throw failure;
};
