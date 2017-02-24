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

def process_message(key,job):
    err_check(job)
    if job['state'] == 'error':
        return

    api_root = job['api_root']
    ts_end = job['end_time']

    if api_root[-1] != '/': api_root += '/'
    job['api_root'] = api_root

    query_params = [{
        "query_type": "where",
        "property_name": "end_time_ms",
        "query_value": ts_end
    }]
    com = Louvaine(api_root,
       '{}geocoder/forward-geo'.format(api_root))

    nodes_to_lookup = set()
    nodes_to_add = list()
    edges_to_add = list()
    invalid_nodes = set()
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
        if 'stats' in node:
            if node['stats']['is_unlikely'] == 0:
                invalid_nodes.add(node_id)
                continue
        nodes_to_add.append(node)

    print "pruning invalid node edges"
    for node_id in invalid_nodes:
        for edge in edges_to_add:
            if edge['target'] == node_id or edge['source'] == node_id:
                edges_to_remove.append(edge)
    for invalid_edge in edges_to_remove:
        if invalid_edge in edges_to_add:
            edges_to_add.remove(invalid_edge)

    print "adding edges to louvaine"
    for edge in edges_to_add:
        com.add_edge(edge)

    print "adding nodes to louvaine"
    for node in nodes_to_add:
        com.add_node(node)

    invalid_nodes.clear()
    nodes_to_lookup.clear()
    del nodes_to_add
    del edges_to_add
    del edges_to_remove

    print "Finding communities from {} nodes and {} edges.".format(len(com.graph.nodes()), len(com.graph.edges()))
    l_com = save_communities(com, job)
    if 'kafka_url' in job and 'kafka_topic' in job:
        kafka_url = job['kafka_url']
        kafka_topic = job['kafka_topic']
        print "Sending events to kafka"
        print "kafka_url"
        print kafka_url
        print "kafka_topic"
        print kafka_topic
        from event_to_kafka import stream_events
        stream_events(l_com.values(), kafka_url, kafka_topic)

    job['data'] = json.dumps({})  # no need to save anything to job
    job['state'] = 'processed'


def save_communities(com, job):
    d1 = com.get_communities()
    for com in d1.values():
        if len(com['cluster_ids']) < 3:
            continue

        matcher.match_and_create_event(com, job)

    return d1

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            queues=['genie:eventfinder'])
    dispatcher.start()

    job = {u'start_time': u'1481124894000', u'state': u'new', u'end_time': u'1481125073999', u'api_root': u'http://172.17.0.1:3000/api'}
    # job = {'start_time': '1481124894000', 'state': 'new', 'end_time': '1481125013999', 'api_root': 'http://172.17.0.1:3000/api',
    #     'kafka_url': 'kafka', 'kafka_topic': 'test:1:1'}
    #process_message(1, job)
    # process_message(1, job)
