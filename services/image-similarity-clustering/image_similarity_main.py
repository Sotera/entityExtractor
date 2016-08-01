
#to test:
    #from the redis cli run these commands
    #hmset 1 "state" "new" "similarity_threshold" .5 "es_host" "54.234.139.42" "similarity_method" "custom" "es_port" "9200" "es_index" "stream" "es_doc_type" "jul2016-uk" "es_query" "{\"fields\":[\"timestamp_ms\",\"features\",\"id\"],\"query\":{\"bool\":{\"must\":{\"term\":{\"features\":0}},\"filter\":{\"range\":{\"timestamp_ms\":{\"gte\":\"1468617997000\",\"lt\":\"1468618897000\"}}}}}}"
    #publish similarity 1

import sys, os
import json
from image_similarity import ImageSimilarity
from elasticsearch import Elasticsearch
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher

def process_message(key, job):
    # get features:
    print 'FINDING SIMILARITY'
    # do the work to find similarity
    image_similarity = ImageSimilarity(float(job['similarity_threshold']), job['similarity_method'])
    es = Elasticsearch([{'host': job['es_host'], 'port': job['es_port']}])
    query = json.loads(job['es_query'])
    data = es.search(index=job['es_index'],
                     body=query,
                     doc_type=job['es_doc_type'],
                     size=100,
                     scroll='10m')

    # process initial results
    for doc in data['hits']['hits']:
        image_similarity.process_vector(doc['fields']['id'][0], doc['fields']['features'])

    sid = data['_scroll_id']
    scroll_size = data['hits']['total']
    while scroll_size > 0:
        print "Scrolling..."
        data = es.scroll(scroll_id=sid, scroll='2m')
        # Update the scroll ID
        sid = data['_scroll_id']
        # Get the number of results that we returned in the last scroll
        scroll_size = len(data['hits']['hits'])
        print "scroll size: " + str(scroll_size)
        # Do something with the obtained page
        for doc in data['hits']['hits']:
            image_similarity.process_vector(doc['fields']['id'][0], doc['fields']['features'])

    print 'FINISHED SIMILARITY PROCESSING'
    job['data'] = image_similarity.to_json()
    job['state'] = 'processed'


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
        process_func=process_message,
        channels=['similarity'])
    dispatcher.start()

