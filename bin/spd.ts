#!/usr/bin/env node

import * as semver from 'semver';
import lolcat from '../src/utils/lolcat';
import logger from '../src/utils/logger';
import * as pkg from '../package.json';
import {favicon1} from '../favicon';

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
  .parse(process.argv);

function notCmd(cmd: string) {
  logger.error(`no <${cmd}> command given!`);
  process.exit(1);
}
