import * as puppeteer from 'puppeteer';
import { getCookies, savaCookies } from './services/helpers';
import { URL } from '../env';

class SPD {
  page: puppeteer.Page;
  navigationOptions: puppeteer.NavigationOptions;

  constructor() {
    this.navigationOptions = {
      waitUntil: [
        'domcontentloaded',
        'networkidle2',
      ]
    };
  }

  async init() {
    const browser = await puppeteer.launch({
      headless: false,
    });
    this.page = await browser.newPage();
    await this.page.setCookie(...getCookies());
    await this.sigin();
  }

  async sigin() {
    const response = await this.page.goto(URL, this.navigationOptions);
    if (response && response.status() === 404) {
      await this.page.evaluate(() => {
        alert('请登录语雀');
      });
      // 持续监听登录态
      while (true) {
        const newResponse = await this.page.waitForNavigation({
          waitUntil: [
            'domcontentloaded',
            'networkidle2',
          ],
        });
        if (URL === this.page.url() && newResponse.status() == 200) {
          console.log('登录语雀成功 🚀');
          savaCookies(await this.page.cookies());
          break;
        }
      }
    } else {
      savaCookies(await this.page.cookies());
    }
  }
}

const spd = new SPD();
spd.init();
