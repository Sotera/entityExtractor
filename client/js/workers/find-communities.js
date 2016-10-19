// def: a web worker that calculates communites from nodes + edges

importScripts('https://d3js.org/d3.v4.js');
importScripts('/bower_components/lodash/dist/lodash.min.js');
importScripts('/js/jlouvain.js');

onmessage = function(event) {
  let {nodes, edges, height, width} = event.data;

  let communities = createCommunities(nodes, edges);

  let simulation = d3.forceSimulation(communities)
    .force('charge', d3.forceManyBody())
    .force('center', d3.forceCenter(width / 2, height / 2))
    // .force("x", d3.forceX())
    // .force("y", d3.forceY())
    .stop();

  let decaySteps = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()));

  for (let i = 0; i < decaySteps; ++i) {
    // postMessage({type: "tick", progress: i / decaySteps});
    simulation.tick();
  }

  postMessage({type: 'end', communities});
};

function createCommunities(nodes, edges) {
  let communityFinder = jLouvain()
    .nodes(nodes)
    .edges(edges);

  let communities = communityFinder();

  // convert to: [{community_id: 1, member_ids: []}, ...]
  let communityMembers = [];

  _.forOwn(communities, function(v, k) {
    let matcher = function(members) { return members.community_id == v };
    let existing = _.find(communityMembers, matcher);
    if (existing)
      existing.member_ids.push(k);
    else
      communityMembers.push({community_id: v, member_ids: [k]});
  });

  return communityMembers;
}
