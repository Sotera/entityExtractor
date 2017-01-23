import sys, os, requests, json
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy
sys.path.append(os.path.join(os.path.dirname(__file__), "./"))
from louvaine import Louvaine


def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg


def err_check(job):
    required = {'host', 'start_time', 'end_time'}
    if not required.issubset(job):
        set_err(job, 'Missing some required fields {}'.format(required))


def process_message(key,job):
    err_check(job)
    if job['state'] == 'error':
        return

    host = os.environ['HOST'] if 'HOST' in os.environ else job['host']

    ts_end = job['end_time']
    debug = False

    if host[-1] != '/': host += '/'
    api_path = host
    query_params = [{
        "query_type": "where",
        "property_name": "end_time_ms",
        "query_value": ts_end
    }]
    com = Louvaine(api_path,
       '{}extract/entities'.format(api_path),
       '{}geocoder/forward-geo'.format(api_path))

    nodes_to_lookup = set()
    nodes_to_add = list()
    edges_to_add = list()
    invalid_nodes = set()
    edges_to_remove = list()

    lp_e = Loopy('{}clusterLinks'.format(api_path), query_params, page_size=500)

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
        clust_url = "{}{}{}".format(api_path, "postsClusters/", node_id)
        node = requests.get(clust_url).json()
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
    l_com = com.save_communities()
    print "Communities Saved!"
    if 'kafka_url' in job.keys() and 'kafka_topic' in job.keys():
        kafka_url = job['kafka_url']
        kafka_topic = job['kafka_topic']
        print "Sending events to kafka"
        print "kafka_url"
        print kafka_url
        print "kafka_topic"
        print kafka_topic
        from event_to_kafka import stream_events
        stream_events(l_com.values(), kafka_url, kafka_topic, debug=debug)

    job['data'] = json.dumps({})  # no need to save anything to job
    job['state'] = 'processed'


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            queues=['genie:eventfinder'])
    dispatcher.start()
