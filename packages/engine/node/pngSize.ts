// Node-only: reads a PNG's width and height from its header (no decoding needed).
import fs from 'node:fs';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function readPngSize(file: string): { width: number; height: number } {
    const header = Buffer.alloc(24);
    const fd = fs.openSync(file, 'r');
    try {
        fs.readSync(fd, header, 0, 24, 0);
    } finally {
        fs.closeSync(fd);
    }
    if (!header.subarray(0, 8).equals(SIGNATURE)) {
        throw new Error(`${file} is not a PNG file`);
    }
    // the IHDR chunk follows the signature: 4 bytes length, 4 bytes "IHDR", then width and height
    return { width: header.readUInt32BE(16), height: header.readUInt32BE(20) };
}
