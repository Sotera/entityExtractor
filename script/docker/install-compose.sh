#!/usr/bin/env bash

if [[ $USER != "root" ]]; then
  echo "This script must be run as root"
  exit 1
fi

set -x

curl -L https://github.com/docker/compose/releases/download/1.9.0/docker-compose-`uname -s`-`uname -m` > /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

