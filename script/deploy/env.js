#!/usr/bin/env node

require('dotenv').config({silent: true});

// create browser global object to store system vars in browser.
// used in npm scripts in package.json

const browserEnvVars = {
  MY_API_KEY: process.env.MY_API_KEY,
  NODE_ENV: process.env.NODE_ENV
};

process.stdout.write(`const WatchmanEnv = ${JSON.stringify(browserEnvVars)};`);
