import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { brotliCompressSync, gzipSync, constants } from 'node:zlib'
async function compress(dir) {
  for (const file of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, file.name)
    if (file.isDirectory()) await compress(path)
    else if (/\.(html|css|js|svg)$/.test(file.name)) {
      const bytes = await readFile(path)
      await Promise.all([
        writeFile(path + '.br', brotliCompressSync(bytes, { params: { [constants.BROTLI_PARAM_QUALITY]: 11 } })),
        writeFile(path + '.gz', gzipSync(bytes, { level: 9 })),
      ])
    }
  }
}
await compress('dist')
