#!/usr/bin/env node

'use strict';

let conf;
try {
  conf = require('../../slc-conf.json');
} catch(ex) {
  console.error('%s. Does slc-config.json exist?', ex);
  process.exit(1);
}

const spawn = require( 'child_process' ).spawnSync
;

run('slc', ['build']);

for (let app of conf) {
  run('slc', ['deploy', '-z', 'cpus', app.slc_host]);
  run('slc', ['ctl', '-C', app.slc_host, 'env-set', 1].concat(app.env));
  run('slc', ['ctl', '-C', app.slc_host, 'set-size', 1, app.cluster_size]);
}


function run(cmd, args) {
  let out = spawn(cmd, args);
  if (out.stdout.length)
    console.info('⇨ %s', out.stdout);
  if (out.stderr.length)
    console.error(':: %s', out.stderr);
  if (out.error)
    console.error('err: %s', out.error);
}
