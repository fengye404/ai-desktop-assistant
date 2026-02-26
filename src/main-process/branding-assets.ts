import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { BRANDING } from '../shared/branding';

function findExistingPath(candidates: string[]): string | null {
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function resolveDesktopIconPath(): string | undefined {
  const appPath = app.getAppPath();

  const candidates = [
    path.join(appPath, BRANDING.desktopIconRelativePath),
    path.join(appPath, 'public/branding/app-icon.png'),
    path.join(appPath, '..', BRANDING.desktopIconRelativePath),
    path.join(appPath, '..', 'public/branding/app-icon.png'),
    path.join(process.cwd(), BRANDING.desktopIconRelativePath),
    path.join(process.cwd(), 'public/branding/app-icon.png'),
    path.join(__dirname, '../public/branding/app-icon-desktop.png'),
    path.join(__dirname, '../public/branding/app-icon.png'),
  ];

  return findExistingPath(candidates) ?? undefined;
}
