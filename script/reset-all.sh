#!/usr/bin/env bash
# Reset collections, clear redis keys, rm downloaded image files
mongo rancor --eval "db.jobMonitor.remove({});db.postsCluster.remove({});db.clusterLink.remove({});db.aggregateCluster.remove({});db.jobSet.remove({})"
mongo rancor --eval "db.socialMediaPost.update({}, {\$set: {state: 'new', primary_image_url: null, primary_image_download_path: null, image_features: [], text_features: []}}, {multi: 1})"
redis-cli flushall
sudo rm -rf /downloads/image-fetcher
