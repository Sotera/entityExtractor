#!/usr/bin/env bash
set -x

# Reset collections, clear redis keys, rm downloaded image files
mongo --host mongo rancor script/remove-collections.js
redis-cli -h redis flushall
sudo rm -rf /downloads/image-fetcher
