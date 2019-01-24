#!/usr/bin/env node

import * as semver from 'semver';
import * as minimist from 'minimist';
import lolcat from '../src/utils/lolcat';
import logger from '../src/utils/logger';
import * as pkg from '../package.json';
import {favicon1} from '../favicon';
import init from './init';
const program = require('commander');

const requiredVersion = pkg.engines.node;
const version = pkg.version;

if (!semver.satisfies(process.version, requiredVersion)) {
  logger.error(
    `You are using Node ${process.version}, but this version of tps ` +
    `requires Node ${requiredVersion}.\nPlease upgrade your Node version.`
  );
  process.exit(1);
}

program
  .version(`
  v${version}
  ${lolcat(favicon1)}
  `)
  .usage('<command> [options]')
  // .allowUnknownOption()
  .arguments('<cmd> [option...]')
  .action(notCmd)

program
  .command('test')
  .description('测试抓取 https://www.yuque.com/sxl7ok/pszm89')
  .action(async (name: string) => {
    const { _, ...res } = minimist(process.argv.slice(3))
    try {
      await init(['https://www.yuque.com/sxl7ok/pszm89'], res);
    } catch (e) {
      e && logger.error(e.message || e.stack);
    }
  })

program
  .command('init [yuque_article_url]...>')
  .description('抓取指定语雀文章，并转为pdf存储 & 支持多文章配置文件抓取')
  .option('-c, --config [file]', './config.json')
  .option('-l, --limit [number]', 5)
  .action(async (name: string) => {
    const { _, ...res } = minimist(process.argv.slice(3))
    try {
      await init(_, res);
    } catch (e) {
      e && logger.error(e.message || e.stack);
    }
  })
  .on('--help', () => {
    console.log();
    console.log('  Examples:');
    console.log();
    console.log(logger.info(' # 抓取指定文章'));
    console.log('    $ spd init "https://www.yuque.com/sxl7ok/pszm89" ');
    console.log();
    console.log(logger.info(' # 抓取多篇文章'));
    console.log('    $ spd init -c config.json');
    console.log();
  });

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
process.on('SIGINT', function () {
  logger.error('spd dialog kill by user!');
  setTimeout(() => { process.exit(); });
});

program.parse(process.argv);

function notCmd(cmd: string) {
  logger.error(`no <${cmd}> command given!`);
  process.exit(1);
}
