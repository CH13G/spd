import * as readdir from 'recursive-readdir';
import * as mkdirp from 'mkdirp';
import * as fs from 'fs';
import * as path from 'path';
// import * as inquirer from 'inquirer';
import { PDF_FLODER, TEMP_FLODER } from '../env';
import logger from '../src/utils/logger';
import SPD from '../src/index';

async function checkIsEmpty() {
  const files = await readdir(process.cwd());
  if (files.length !== 0) {
    throw new Error('当前目录不为空，请先清空目录');
  }
}

async function initPdfFloder() {
  try {
    fs.accessSync(TEMP_FLODER);
  } catch (error) {
    logger.step('您是第一次使用spd，为您创建 temp 存储您个人信息');
    mkdirp.sync(TEMP_FLODER);
  }

  try {
    fs.accessSync(PDF_FLODER);
  } catch (error) {
    logger.step('检测到首次在新项目执行 init 命令，创建pdf存储目录');
    mkdirp.sync(PDF_FLODER);
  }
}
export default async function init(urls: string[], option: {
  config?: string;
  [key: string]: any;
}) {
  await checkIsEmpty();
  await initPdfFloder();
  const allUrls = urls;
  if (option.config) {
    const configFile = path.join(process.cwd(), option.config);
    try {
      fs.accessSync(configFile);
      const json = fs.readFileSync(configFile, { encoding: 'utf-8' });
      const jsonUrls = Object.values(json).filter(u => !!u);
      Array.prototype.push.apply(allUrls, jsonUrls);
    } catch (error) {
      throw new Error(`检测到您传入的配置文件【${configFile}】不存在，请参考使用说明 $ spd init --hellp`);
    }
  }
  const spd = new SPD({
    urls: allUrls,
    MAX_ASYNC: option.limit || 5,
  });
  await spd.init();
}
