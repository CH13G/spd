import * as puppeteer from 'puppeteer';
import { getCookies, saveCookies } from './services/helpers';
import logger from './utils/logger';
import { URL } from '../env';
import Article from '../typings/article';

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
    await this.getAnalyzeChapters();
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
          logger.success('登录语雀成功，已记录用户信息');
          saveCookies(await this.page.cookies());
          break;
        }
      }
    } else {
      logger.start('使用缓存用户信息登录语雀');
      saveCookies(await this.page.cookies());
    }
  }

  async getAnalyzeChapters() {
    const { page } = this;
    const $article = await page.$('.main-book-cover-inner');
    const title = await $article.$eval(' .main-book-cover-title span', e => e.textContent);
    const subtitle = await $article.$eval('.main-book-cover-meta .desc', e => e.textContent);
    const $authors = await $article.$$('.main-book-cover-contributors a');
    const authors = {} as Article.authors;
    const authorPromiseLits = $authors.map(async (element, i) => {
      const href = await element.getProperty('href');
      const name = await element.$eval('img', e => e.getAttribute('alt'));
      authors[i] = {
        href: await href.jsonValue(),
        name,
      };
    })
    await Promise.all(authorPromiseLits);
    const $chapters = await $article.$$('.typo-catalog-detail li');
    const chapters = {} as Article.chapters;
    const chapterPromiseLits = $chapters.map(async (element, i) => {
      const $inner = await element.$('.catalog-item');
      // 有内容，才是有效章节
      if ($inner) {
        let info = { isPlain: false } as Article.chapter;
        const classList: string = await $inner.getProperty('className').then(classList => classList.jsonValue());
        const realLink = await $inner.$eval('a', (e: HTMLLinkElement) => e.href).catch(err => {
          info.isPlain = true;
        });
        const [name, slug] = await Promise.all([
          $inner.$eval('.name', e => e.textContent),
          $inner.$eval('.slug', e => e.textContent),
        ]);
        chapters[i] = Object.assign(info, {
          link: realLink,
          level: classList.replace(/.*catalog-item-(\d+).*/, (match, $1) => $1),
          name,
          slug,
        });
      }
    });
    await Promise.all(chapterPromiseLits);
    console.log('chapters', $chapters.length, chapters);
  }
}

const spd = new SPD();
spd.init();
