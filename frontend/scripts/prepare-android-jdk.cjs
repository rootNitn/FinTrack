const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { pipeline } = require('node:stream/promises');
const { Readable } = require('node:stream');

async function main() {
  const directory = path.join(os.homedir(), '.lifetrack', 'toolchains');
  fs.mkdirSync(directory, { recursive: true });
  const existing = fs.readdirSync(directory).find(name => name.startsWith('jdk-21') && fs.existsSync(path.join(directory, name, 'bin/java.exe')));
  if (existing) { console.log('Java 21 available:', path.join(directory, existing)); return; }
  const metadata = await fetch('https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows');
  if (!metadata.ok) throw new Error('Could not retrieve the official Temurin Java 21 package');
  const asset = (await metadata.json())[0].binary.package;
  const archive = path.join(directory, 'temurin-jdk21.zip');
  const response = await fetch(asset.link);
  if (!response.ok || !response.body) throw new Error('Java 21 download failed');
  await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(archive));
  const checksum = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(archive)) checksum.update(chunk);
  if (checksum.digest('hex') !== asset.checksum) throw new Error('Java package checksum mismatch');
  const extracted = spawnSync('tar.exe', ['-xf', archive, '-C', directory], { stdio: 'inherit' });
  if (extracted.status !== 0) throw new Error('Could not extract Java 21');
  fs.unlinkSync(archive);
  console.log('Portable Java 21 installed; global Java settings are unchanged.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });