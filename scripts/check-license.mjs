import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export async function checkLicense(root = process.cwd()) {
  const pkg = JSON.parse(await fs.readFile(`${root}/package.json`, 'utf8'));
  if (pkg.license !== 'Apache-2.0') {
    throw new Error(`package.json license must stay Apache-2.0, got ${pkg.license ?? 'missing'}`);
  }
  if (!Array.isArray(pkg.files) || !pkg.files.includes('LICENSE') || !pkg.files.includes('NOTICE')) {
    throw new Error('Published package must include LICENSE and NOTICE');
  }

  const lock = JSON.parse(await fs.readFile(`${root}/package-lock.json`, 'utf8'));
  if (lock.packages?.['']?.license !== 'Apache-2.0') {
    throw new Error('package-lock.json root package license must stay Apache-2.0');
  }

  const license = await fs.readFile(`${root}/LICENSE`, 'utf8');
  if (!license.startsWith('Apache License\n') ||
      !license.includes('Version 2.0, January 2004') ||
      !license.includes('3. Grant of Patent License.')) {
    throw new Error('LICENSE is not the expected Apache License 2.0 text');
  }

  const notice = await fs.readFile(`${root}/NOTICE`, 'utf8');
  if (!notice.includes('AIDoneCheck') || !notice.includes('Copyright 2026 Lucas Lu')) {
    throw new Error('NOTICE is missing AIDoneCheck copyright attribution');
  }

  const readme = await fs.readFile(`${root}/README.md`, 'utf8');
  if (!readme.includes('license-Apache--2.0') ||
      !readme.includes('[Apache License 2.0](LICENSE)') ||
      !readme.includes('[NOTICE](NOTICE)')) {
    throw new Error('README license metadata is not consistently Apache-2.0');
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkLicense();
  console.log('Apache-2.0 license policy verified');
}
