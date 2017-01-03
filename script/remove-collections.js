// remove collections
db.jobMonitor.remove({})
db.postsCluster.remove({})
db.clusterLink.remove({})
db.aggregateCluster.remove({})
db.jobSet.remove({})
db.event.remove({})
db.socialMediaPost.update({}, {$set: {state: 'new', primary_image_url: null, primary_image_download_path: null, image_features: [], text_features: []}}, {multi: 1})
