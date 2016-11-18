import sys, os, argparse, requests
sys.path.append(os.path.join(os.path.dirname(__file__), "./"))
from event_to_kafka import stream_events
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from loopy import Loopy
from louvaine import Louvaine

def create_events(host, ts_start, ts_end, kafka_url, kafka_topic):
    if host[-1] != '/': host += '/'
    api_path = host + 'api/'
    query_params = [{
        "query_type": "between",
        "property_name": "end_time_ms",
        "query_value": [ts_start, ts_end]
    }]
    com = Louvaine(api_path,
       '{}extract/entities'.format(api_path),
       '{}geocoder/forward-geo'.format(api_path))
    lp_n = Loopy('{}aggregateClusters'.format(api_path), query_params, page_size=500)

    #print "getting aggregate clusters"
    #while True:
    #    page = lp_n.get_next_page()
    #    if page is None:
    #        break
    #    for doc in page:
    #        com.add_node(doc)

    nodes_to_add = set()
    lp_e = Loopy('{}clusterLinks'.format(api_path), query_params, page_size=500)

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

    print " communities"
    l_com = com.save_communities()
    print "Communities Saved!"
    if kafka_url is not None and kafka_topic is not None:
        "Sending events to kafka"
        stream_events(l_com, kafka_url, kafka_topic)


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("host", help="protocol + host - Ex. http://localhost:3000 or http://watchman:3003")
    parser.add_argument("start_time", type=int, help="Milisecond timestamp for query start")
    parser.add_argument("end_time", type=int,help="Milisecond timestamp for query end")
    parser.add_argument("-kafka_url", type=str, help="If writing events to kafka, specify url (default=None)", default=None)
    parser.add_argument("-kafka_topic", type=str, help="If writing event to kafka, specify topic (default=None)", default=None)

    args = parser.parse_args()

    create_events(args.host, args.start_time, args.end_time, args.kafka_url, args.kafka_topic)
