'use strict';

// def: parse rss feeds and store data

const app = require('../../server/server');
const INTERVAL = 15; // seconds
const _ = require('lodash');
let intervals = {}; // keep track of running intervals

const worker = module.exports = {
  start() {
    const TextFeed = app.models.TextFeed;
    run(); //first run
    // periodically check for new TextFeed sources
    setInterval(run, 60 * 1000);

    function run() {
      console.log('checking for new text feed sources');
      TextFeed.find( { where: { active: true } } )
      .then(process)
      .catch(console.error);
    }
  }
};

// start if run as a worker process
if (require.main === module)
  worker.start();

function process(feeds) {
  const runningFeedIds = Object.keys(intervals);
  // feeds removed?
  if (runningFeedIds.length && (feeds.length < runningFeedIds.length)) {
    const feedIds = _(feeds).map(feed => feed.id.toString()).value();
    _(runningFeedIds)
      .difference(feedIds)
      .tap(ids => console.log('stopping feed ids', ids))
      .each(id => {
        clearInterval(intervals[id]);
        delete intervals[id];
      });
    return;
  // return if nothing changed or no feeds in db
  } else if (!feeds.length || (feeds.length == runningFeedIds.length)) {
    console.log('no new text feed sources found');
    return;
  } else {
    let FeedClass, processor, feedId;
    feeds.forEach(feed => {
      feedId = feed.id.toString(); // obj -> to string for comparison
      console.log('watching', feed.url);
      if (!_.includes(runningFeedIds, feedId)) {
        console.log('processing', feed.url);
        //expects textfeed.feedType to match feed-processors/ file names
        FeedClass = require('../feed-processors/' + feed.feedType.toLowerCase() + '.js');
        processor = new FeedClass(feed);

        // periodically check for new feed items
        intervals[feedId] = setInterval(processor.process.bind(processor), feed.interval);
        processor.process(); // first run
      }
    });
  }
}
