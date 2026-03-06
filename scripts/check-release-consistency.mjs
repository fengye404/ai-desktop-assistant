import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function readJson(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readText(relativePath) {
  const filePath = path.join(projectRoot, relativePath);
  return fs.readFileSync(filePath, 'utf8');
}

function normalizePlatforms(buildConfig) {
  const platforms = [];
  if (buildConfig?.mac) platforms.push('macOS');
  if (buildConfig?.win) platforms.push('Windows');
  if (buildConfig?.linux) platforms.push('Linux');
  return platforms;
}

function extractBadgeValue(content, regex, label, filePath) {
  const match = content.match(regex);
  if (!match || typeof match[1] !== 'string') {
    throw new Error(`${filePath} 缺少 ${label} 徽章或格式不匹配。`);
  }
  return match[1];
}

function main() {
  const pkg = readJson('package.json');
  const lock = readJson('package-lock.json');
  const readmeEn = readText('README.md');
  const readmeZh = readText('README.zh-CN.md');

  const expectedVersion = pkg.version;
  const expectedPlatform = encodeURIComponent(normalizePlatforms(pkg.build).join(' | '));
  const errors = [];

  const enVersion = extractBadgeValue(
    readmeEn,
    /!\[Version\]\(https:\/\/img\.shields\.io\/badge\/version-([^-]+)-/,
    'Version',
    'README.md',
  );
  const zhVersion = extractBadgeValue(
    readmeZh,
    /!\[版本\]\(https:\/\/img\.shields\.io\/badge\/version-([^-]+)-/,
    '版本',
    'README.zh-CN.md',
  );
  const enPlatform = extractBadgeValue(
    readmeEn,
    /!\[Platform\]\(https:\/\/img\.shields\.io\/badge\/platform-([^-]+)-6b7280\)/,
    'Platform',
    'README.md',
  );
  const zhPlatform = extractBadgeValue(
    readmeZh,
    /!\[平台\]\(https:\/\/img\.shields\.io\/badge\/platform-([^-]+)-6b7280\)/,
    '平台',
    'README.zh-CN.md',
  );

  if (enVersion !== expectedVersion) {
    errors.push(`README.md version 徽章为 ${enVersion}，应为 ${expectedVersion}`);
  }
  if (zhVersion !== expectedVersion) {
    errors.push(`README.zh-CN.md version 徽章为 ${zhVersion}，应为 ${expectedVersion}`);
  }
  if (enPlatform !== expectedPlatform) {
    errors.push(`README.md platform 徽章为 ${decodeURIComponent(enPlatform)}，应为 ${decodeURIComponent(expectedPlatform)}`);
  }
  if (zhPlatform !== expectedPlatform) {
    errors.push(`README.zh-CN.md platform 徽章为 ${decodeURIComponent(zhPlatform)}，应为 ${decodeURIComponent(expectedPlatform)}`);
  }

  if (lock.version !== expectedVersion) {
    errors.push(`package-lock.json 顶层 version 为 ${lock.version}，应为 ${expectedVersion}`);
  }
  if (lock.packages?.['']?.version !== expectedVersion) {
    errors.push(`package-lock.json packages[\"\"] version 为 ${lock.packages?.['']?.version}, 应为 ${expectedVersion}`);
  }

  if (errors.length > 0) {
    console.error('[release-consistency] 检查失败:');
    for (const error of errors) {
      console.error(`- ${error}`);
    }
    process.exit(1);
  }

  console.log('[release-consistency] 校验通过');
}

main();
