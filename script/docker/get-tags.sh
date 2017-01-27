#!/usr/bin/env bash

jq=`which jq`

if ! [ -e "$jq" ]; then
  echo 'You need to install jq from https://stedolan.github.io/jq/download/'
  exit $?
fi

for name in 'absentfriends' 'caffe_redis_client' 'comedian' 'dr-manhattan' \
'feature-sim' 'image-fetcher' 'ozymandias' 'rorschach'
do
  curl -s https://registry.hub.docker.com/v2/repositories/sotera/$name/tags/ |
  jq --arg name $name '."results"[0] | {name: [$name]} + {last_tag: .name, updated: .last_updated}'
done
