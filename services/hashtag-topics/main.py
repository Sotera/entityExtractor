import sys, os, json
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
import event_matcher as matcher
from loopy import Loopy
from louvaine import Louvaine

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    required = {'api_root', 'start_time', 'end_time'}
    if not required.issubset(job):
        set_err(job, 'Missing some required fields {}'.format(required))

def combine_nodes(nodes, edges):
    node_map = {}
    combined_nodes = []
    combined_edges = []
    for node in nodes:
        term = node['term']
        if term not in node_map:
            node_map[term] = []
        node_map[term].append(node)

    for term, nodes in node_map.iteritems():
        combined_node = None
        for node in nodes:
            if combined_node is None:
                combined_node = node
                continue
            combined_node['similar_ids'] += node['similar_ids']
            combined_node['similar_post_ids'] += node['similar_post_ids']
            for edge in edges:
                if edge['source'] == node['id']:
                    edge['source'] = combined_node['id']
                if edge['target'] == node['id']:
                    edge['target'] = combined_node['id']
        combined_nodes.append(combined_node)

    for edge in edges:
        for node in combined_nodes:
            if node['id'] == edge['source'] or node['id'] == edge['target']:
                if edge not in combined_edges:
                    combined_edges.append(edge)
                    break

    return {'nodes': combined_nodes, 'edges': combined_edges}

def process_message(key,job):
    err_check(job)
    if job['state'] == 'error':
        return

    api_root = job['api_root']

    if api_root[-1] != '/': api_root += '/'
    job['api_root'] = api_root

    query_params = [{
            'query_type': 'between',
            'property_name': 'end_time_ms',
            'query_value': [job['start_time'], job['end_time']],
        },
        {
            'query_type': 'where',
            'property_name': 'source_data_type',
            'query_value': 'hashtag'
        },
        {
            'query_type': 'where',
            'property_name': 'target_data_type',
            'query_value': 'hashtag'
        }
    ]
    com = Louvaine(api_root)

    nodes_to_lookup = set()
    nodes_to_add = list()
    edges_to_add = list()
    edges_to_remove = list()

    lp_e = Loopy('{}clusterLinks'.format(api_root), query_params, page_size=500)

    if lp_e.result_count == 0:
        print 'No data to process'
        job['data'] = []
        job['error'] = 'No data found to process.'
        job['state'] = 'error'
        return

    print "getting cluster links"
    while True:
        page = lp_e.get_next_page()
        if page is None:
            break
        for doc in page:
            nodes_to_lookup.add(doc["target"])
            nodes_to_lookup.add(doc["source"])
            edges_to_add.append(doc)

    print "getting node data"
    for node_id in nodes_to_lookup:
        clust_url = "{}{}{}".format(api_root, "postsClusters/", node_id)
        node = Loopy.get(clust_url)
        nodes_to_add.append(node)

    combined_data = combine_nodes(nodes_to_add, edges_to_add)
    nodes_to_add = combined_data['nodes']
    edges_to_add = combined_data['edges']

    print "adding edges to louvaine"
    for edge in edges_to_add:
        com.add_edge(edge)

    print "adding nodes to louvaine"
    for node in nodes_to_add:
        com.add_node(node)

    nodes_to_lookup.clear()
    del nodes_to_add
    del edges_to_add
    del edges_to_remove

    print "Finding communities from {} nodes and {} edges.".format(len(com.graph.nodes()), len(com.graph.edges()))
    communities = save_communities(com, job)
    group_id = 0
    for community in communities:
        community['group'] = group_id
        group_id= group_id + 1

    job['network'] = json.dumps(combined_data)
    with open('network.json', 'w') as outfile:
        json.dump(combined_data, outfile)

    for node in combined_data['nodes']:
        for community in communities:
            if node['id'] in community['cluster_ids']:
                node['group'] = community['group']
                break

    job['communities'] = json.dumps(communities)
    job['community_network'] = json.dumps(combined_data)
    with open('community_network.json', 'w') as outfile:
        json.dump(combined_data, outfile)

    job['data'] = json.dumps({})  # no need to save anything to job
    job['state'] = 'processed'


def save_communities(com, job):
    d1 = com.get_communities()
    topics = []
    for com in d1.values():
        if len(com['cluster_ids']) < 3:
            continue
        topics.append(com)

    return topics

if __name__ == '__main__':
    #dispatcher = Dispatcher(redis_host='redis',
    #                        process_func=process_message,
    #                        queues=['genie:hashtagtopics'])
    #dispatcher.start()

    job = {'start_time': '1498510012401', 'state': 'new', 'end_time': '1498588198307', 'api_root': 'http://localhost:3003/api'}
    #job = {u'start_time': u'1495826344820', u'state': u'new', u'end_time': u'1495826644819', u'api_root': u'http://172.17.0.1:3003/api'}
    process_message(1, job)
