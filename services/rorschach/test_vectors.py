from elasticsearch import Elasticsearch
import numpy as np
import matplotlib.pyplot as plt

def nz_inds(vec):
    l_ret = []
    for i in range(len(vec)):
        if vec[i]!=0:
            l_ret.append(i)
    return l_ret


es = Elasticsearch([{"host":"54.234.139.42", "port":9200}])
print "ES:", es.ping()
res = es.search(index='stream', doc_type='jul2016-uk',
    body='{"query":{"exists": {"field": "features"}}}', size=100)
print "Total", res['hits']['total']
hits = res['hits']['hits']
n_hits = []
used_inds = []
used_mult_inds = []
for hit in hits:
    src = hit['_source']
    features = src['features']
    try:
        vl = len(features)
    except:
        #print "!!!"
        continue
    if vl == 1: # len 1 == featurizer failed
        continue
    fv = features

    used = nz_inds(fv)
    nz = len(used)
    if nz==1:
        used_inds.extend(used)
        print used
    else:
        used_mult_inds.extend(used)
        print nz
    n_hits.append(nz)
    print "used inds:", len(used), src['id_str'], src['instagram']


plt.figure(1)
plt.subplot(221)
plt.hist(n_hits, range(0,1200,20))
plt.yscale('log', nonposy='clip')
x1, x2, y1, y2 = plt.axis()
plt.axis((x1,x2,0.1,10000))
plt.title("Num non-zero inds")
#plt.subplot(222)
#plt.hist(n_hits, range=(-0.5,10.5,1))
#plt.yscale('log', nonposy='clip')
#plt.title("Zoom")
plt.subplot(223)
plt.hist(used_inds)
plt.title("Used index, when 1")
plt.subplot(224)
plt.hist(used_mult_inds)
plt.title("Used index, when many")
plt.show()
