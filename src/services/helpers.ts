import * as puppeteer from 'puppeteer';
import * as fs from 'fs';
import { COOKIE_PATH } from '../../env';

export function saveCookies(cookies: puppeteer.Cookie[]) {
  fs.writeFileSync(COOKIE_PATH, JSON.stringify(cookies));
}

export function getCookies(): puppeteer.Cookie[] {
  if (fs.existsSync(COOKIE_PATH)) {
    const cookiesStr = fs.readFileSync(COOKIE_PATH, { encoding: 'utf-8' });
    return JSON.parse(cookiesStr || '[]');
  }
  return [];
}
