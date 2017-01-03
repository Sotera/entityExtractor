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

    host = job['host']
    ts_start = job['start_time']
    ts_end = job['end_time']
    debug = False

    if host[-1] != '/': host += '/'
    api_path = host
    query_params = [{
        "query_type": "between",
        "property_name": "end_time_ms",
        "query_value": [ts_start, ts_end]
    }]
    com = Louvaine(api_path,
       '{}extract/entities'.format(api_path),
       '{}geocoder/forward-geo'.format(api_path))

    # this one line was being run..not sure why..as it was unused???
    # lp_n = Loopy('{}aggregateClusters'.format(api_path), query_params, page_size=500)

    #print "getting aggregate clusters"
    #while True:
    #    page = lp_n.get_next_page()
    #    if page is None:
    #        break
    #    for doc in page:
    #        com.add_node(doc)

    nodes_to_add = set()
    lp_e = Loopy('{}clusterLinks'.format(api_path), query_params, page_size=500)

    if lp_e.result_count == 0:
        print 'No data to process'
        job['data'] = []
        job['error'] = 'No data found to process.'
        job['state'] = 'error'
        return

    print "getting aggregate cluster links"
    while True:
        page = lp_e.get_next_page()
        if page is None:
            break
        for doc in page:
            if doc["target"] not in com.nodes_detailed:
                nodes_to_add.add(doc["target"])
            if doc["source"] not in com.nodes_detailed:
                nodes_to_add.add(doc["source"])
            com.add_edge(doc)

    print "filling in missing nodes"
    for node_id in nodes_to_add:
        agg_url = "{}{}{}".format(api_path, "aggregateClusters/", node_id)
        node = requests.get(agg_url).json()
        com.add_node(node)

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
