import * as puppeteer from 'puppeteer';
import * as path from 'path';
import * as fs from 'fs';
import * as mkdirp from 'mkdirp';
import * as async from 'async';
import { getCookies, saveCookies } from './services/helpers';
import logger from './utils/logger';
import { PDF_FLODER } from '../env';
import Article from '../typings/article';

export interface SPDProps {
  MAX_ASYNC?: number; // 最大并发数量
  urls: string[]; // 所有要爬取的url
}

export default class SPD {
  static defaultProps = {
    MAX_ASYNC: 5,
    navigationOptions: {
      waitUntil: [
        'domcontentloaded',
        'networkidle2',
      ]
    },
  }
  page: puppeteer.Page;
  browser: puppeteer.Browser;
  navigationOptions: puppeteer.NavigationOptions;
  URLS: string[];
  MAX_ASYNC: number;
  headless: boolean;

  constructor(props: SPDProps) {
    this.URLS = props.urls || [];
    this.MAX_ASYNC = props.MAX_ASYNC;
    this.headless = true;
  }

  async init() {
    await this.createBrowser();
    const isLogin = await this.detectIsLogin();
    if (!isLogin) {
      // 没有登录，
      this.headless = false;
      await this.browser.close();
      await this.createBrowser();
      await this.sigin();

      this.headless = true;
      await this.browser.close();
      await this.createBrowser();
    } else {
      logger.info('使用缓存用户信息登录语雀');
      saveCookies(await this.page.cookies());
    }
    logger.start('开始进入爬取阶段');
    const URLS = this.URLS.filter(u => !!u);
    const count = URLS.length;
    logger.step(`您总共有 ${count} 篇有效文章需要抓取`);
    // 每次爬取一篇文章
    for (let i = 0; i < URLS.length; i++) {
      const url = URLS[i];
      logger.step(`
        当前正在爬取第 ${i + 1} 篇 【${url}】
      `);
      await this.spiderArticle(url);
      const precent = (i + 1) / count * 100;
      logger.step(`
        爬取第 ${i + 1} 篇 完成
        进度 ====>【${ precent.toFixed(4)}%】
      `);
    }
    logger.done(`
     爬取所有文章完成
     总计 【 ${count} 】篇
    `);
    process.exit(1);
  }

  async createBrowser() {
    const browser = await puppeteer.launch({
      headless: this.headless,
      defaultViewport: {
        width: 1200,
        height: 720
      }
    });
    this.browser = browser;
    this.page = await browser.newPage();
    const cookies = getCookies();
    await this.page.setCookie(...cookies);
  }

  async detectIsLogin() {
    const response = await this.page.goto('https://www.yuque.com/login', this.navigationOptions);
    if (response && (response.status() === 302 || response.url() !== 'https://www.yuque.com/login')) {
      return true;
    }
    return false;
  }

  newPagePromise(): Promise<puppeteer.Page> {
    return new Promise((x) => this.browser.once('targetcreated', async (target) => {
      const newPage = await target.page();
      const newPagePromise = new Promise(() => newPage.once('load', () => x(newPage)));
      const isPageLoaded = await newPage.evaluate(() => document.readyState);
      return isPageLoaded.match('complete|interactive') ? x(newPage) : newPagePromise;
    }));
  }

  async spiderArticle(url: string) {
    const response = await this.page.goto(url, this.navigationOptions);
    if (response && response.status() === 404) {
      return logger.error(`${url} not found`);
    }
    const article = await this.getAnalyzeChapters();
    const chapterArr = Object.values(article.chapters);
    const ARTICLE_FLODER = path.join(PDF_FLODER, article.title);
    try {
      fs.accessSync(ARTICLE_FLODER);
    } catch (error) {
      logger.step(`创建【${article.title}】 pdf目录`);
      mkdirp.sync(ARTICLE_FLODER);
    }
    // 写入爬去文章信息.
    fs.writeFileSync(path.join(ARTICLE_FLODER, '.info.json'), JSON.stringify(article));
    return new Promise((resolve, reject) => {
      async.mapLimit(chapterArr, this.MAX_ASYNC, async (c, callack) => {
        if (c.isPlain) {
          return callack(null, {
            isError: true,
            ...c,
          });
        }
        const page = await this.browser.newPage();
        const title = `${c.name}-${c.level}-${c.slug}`;
        const response = await page.goto(c.link, this.navigationOptions);
        if (response && response.status() === 404) {
          return callack(new Error('404'), {
            isError: true,
            ...c,
          });
        } else {
          try {
            const $more = await page.$('.lark-popover .larkicon-more');
            await $more.hover();
            let count = 0;
            let $menuLists: puppeteer.ElementHandle<HTMLElement>[];
            // 保证获取到 功能演示按钮， 最多尝试10次
            while (true) {
              $menuLists = await page.$$('.lark-popover .ant-popover .ant-menu-item');
              if ($menuLists.length > 0 || count > 10) {
                break;
              }
              count++;
              await page.waitFor(100);
            }
            let $previewBtn: puppeteer.ElementHandle<HTMLElement>;
            for (let i = 0; i < $menuLists.length; i++) {
              const element = $menuLists[i];
              const text = await element.$eval('a', e => e.textContent);
              if (text === '演 示') {
                $previewBtn = element;
                break;
              }
            }
            if ($previewBtn) {
              // 新开演示页
              let waitI = 0;
              // 延时点击 演示按钮
              const btnHandle = async () => {
                while (true) {
                  try {
                    await $previewBtn.click();
                    break;
                  } catch (error) {
                    await page.waitFor(100);
                    if (waitI > 10) {
                      break;
                    }
                    waitI++;
                  }
                }

              }
              const [newPage] = await Promise.all([
                this.newPagePromise(),
                btnHandle(),
              ]);
              await newPage.pdf({
                path: path.join(ARTICLE_FLODER, `${title}.pdf`)
              });
              logger.success(`---> ${title}`);
              return callack(null, {
                isOk: true,
                ...c,
              });
            }
          } catch (error) {
            callack(error, {
              isError: true,
              ...c,
            });
          }
        }
      }, (err, res) => {
        if (err) {
          logger.error(err.message);
          reject(err)
        } else {
          resolve(res);
        }
      })
    })

  }

  async sigin() {
    // 持续监听登录态
    while (true) {
      await this.detectIsLogin();
      const tip = '请登录语雀,目前支持识别 -手机号 - 密码登录 方式登录';
      await this.page.evaluate(() => {
        alert(tip);
      });
      logger.info(tip);
      try {
        const response = await this.page.waitForResponse('https://www.yuque.com/api/accounts/login', {
          timeout: 1000 * 60 * 5
        });
        if (response && response.status()) {
          logger.success('登录语雀成功，已记录用户信息');
          const cookies = await this.page.cookies()
          saveCookies(cookies);
          break;
        }
      } catch (error) {
        logger.error(error.message || error.stack);
        process.exit(1);
      }
    }
  }

  async getAnalyzeChapters() {
    const { page } = this;
    const $article = await page.$('.main-book-cover-inner');
    const title = await $article.$eval(' .main-book-cover-title span', e => e.textContent);
    let subtitle = '';
    try {
      subtitle = await $article.$eval('.main-book-cover-meta .desc', e => e.textContent);
    } catch (error) {
      logger.warn(`【${title}】 , 没有副标题`);
    }
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
    return {
      title,
      subtitle,
      authors,
      chapters,
    };
  }
}

// const spd = new SPD();
// spd.init();
