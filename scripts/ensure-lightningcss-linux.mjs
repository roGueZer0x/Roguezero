import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';

const requireFromHere = createRequire(import.meta.url);

if (process.platform !== 'linux') {
  process.exit(0);
}

const candidates = ['lightningcss-linux-x64-gnu', 'lightningcss-linux-x64-musl'];

const hasAnyLinuxBinary = candidates.some((pkgName) => {
  try {
    requireFromHere.resolve(`${pkgName}/package.json`, { paths: [process.cwd()] });
    return true;
  } catch {
    return false;
  }
});

if (hasAnyLinuxBinary) {
  process.exit(0);
}

const preferredPackage = 'lightningcss-linux-x64-gnu@1.32.0';
execSync(`npm install --no-save ${preferredPackage}`, { stdio: 'inherit' });