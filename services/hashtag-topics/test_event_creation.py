import sys, requests
sys.path.append('/Users/jgartner/projects/xdata/QCR/watchman/services/util/')
from loopy import Loopy

sys.path.append('/Users/jgartner/projects/xdata/QCR/watchman/services/dr-manhattan/')
from louvaine import Louvaine

query_params = [{
        "query_type": "between",
        "property_name": "end_time_ms",
        "query_value": [1477580423000, 1477780423000]
    }]

lp_n = Loopy('http://localhost:3003/api/postsClusters', query_params)
com = Louvaine('http://localhost:3003/api/',
               'http://54.89.54.199:3003/api/extract/entities',
               'http://54.89.54.199:3003/api/geocoder/forward-geo')
while True:
    page = lp_n.get_next_page()
    if page is None:
        break
    for doc in page:
        com.add_node(doc)

lp_e = Loopy('http://localhost:3003/api/clusterLinks', query_params)
while True:
    page = lp_e.get_next_page()
    if page is None:
        break
    for doc in page:
        com.add_edge(doc)

com.save_communities()
#com.get_communities()
