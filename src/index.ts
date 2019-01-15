import * as puppeteer from 'puppeteer';
import { getCookies, saveCookies } from './services/helpers';
import logger from './utils/logger';
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
        logger.info('请登录语雀');
      });
      // 持续监听登录态
      while (true) {
        const newResponse = await this.page.waitForNavigation(this.navigationOptions);
        if (URL === this.page.url() && newResponse.status() == 200) {
          logger.success('登录语雀成功');
          saveCookies(await this.page.cookies());
          break;
        }
      }
    } else {
      saveCookies(await this.page.cookies());
    }
  }
}

const spd = new SPD();
spd.init();
