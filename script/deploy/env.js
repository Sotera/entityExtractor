#!/usr/bin/env node

require('dotenv').config({silent: true});

// create browser global object to store system vars in browser.
// used in npm scripts in package.json

// take all env vars with prefix 'UI_'
const envVars = Object.keys(process.env)
  .filter(key => key.match(/^UI_(.+)/))
  .reduce((acc, key) => {
    acc[key] = process.env[key];
    return acc;
  }, {});

// output can be piped to scripts
process.stdout.write(`const WatchmanEnv = ${JSON.stringify(envVars)};`);
