#!/usr/bin/env bash
set -x

# Reset collections, clear redis keys, rm downloaded image files
mongo --host mongo rancor --eval "db.jobMonitor.remove({});db.postsCluster.remove({});db.clusterLink.remove({});db.aggregateCluster.remove({});db.jobSet.remove({});db.event.remove({})"
mongo --host mongo rancor --eval "db.socialMediaPost.update({}, {\$set: {state: 'new', primary_image_url: null, primary_image_download_path: null, image_features: [], text_features: []}}, {multi: 1})"
redis-cli -h redis flushall
sudo rm -rf /downloads/image-fetcher
