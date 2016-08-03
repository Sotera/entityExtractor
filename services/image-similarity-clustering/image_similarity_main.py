
# to test:
# from the redis cli run these commands
# hmset 1 "state" "new" "start_time_ms" 1468617997000 "end_time_ms" 1468618897000 "similarity_threshold" .5 "es_host" "54.234.139.42" "similarity_method" "custom" "es_port" "9200" "es_index" "stream" "es_doc_type" "jul2016-uk" "es_query" "{\"fields\":[\"timestamp_ms\",\"features\",\"id\"],\"query\":{\"bool\":{\"must\":{\"term\":{\"features\":0}},\"filter\":{\"range\":{\"timestamp_ms\":{\"gte\":\"1468617997000\",\"lt\":\"1468618897000\"}}}}}}"
# publish similarity 1

import sys
import os
import json
import time
from image_similarity import ImageSimilarity
from elasticsearch import Elasticsearch
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher


def process_data(image_similarity, data):
    if len(data['hits']['hits']) == 0:
        return

    print 'PROCESSING {}'.format(len(data['hits']['hits']))

    start = time.clock()
    for doc in data['hits']['hits']:
        image_similarity.process_vector(doc['fields']['id'][0], doc['fields']['features'])
    end = time.clock()
    duration = end - start
    print 'SIMILARITY PROCESSING of {} took {}'.format(len(data['hits']['hits']), duration)


def process_message(key, job):
    # get features:
    print 'FINDING SIMILARITY'

    # do the work to find similarity
    image_similarity = ImageSimilarity(float(job['similarity_threshold']), job['start_time_ms'],
                                       job['end_time_ms'], job['similarity_method'])
    es = Elasticsearch([{'host': job['es_host'], 'port': job['es_port']}])
    query = json.loads(job['es_query'])

    total_time = time.clock()

    data = es.search(index=job['es_index'],
                     body=query,
                     doc_type=job['es_doc_type'],
                     size=100,
                     scroll='10m')

    # process initial results
    process_data(image_similarity, data)

    sid = data['_scroll_id']
    scroll_size = data['hits']['total']
    total_items = data['hits']['total']

    while scroll_size > 0:
        print "Scrolling..."
        data = es.scroll(scroll_id=sid, scroll='2m')
        # Update the scroll ID
        sid = data['_scroll_id']
        # Get the number of results that we returned in the last scroll
        scroll_size = len(data['hits']['hits'])
        # Do something with the obtained page
        process_data(image_similarity, data)

    print 'FINISHED SIMILARITY PROCESSING of {} took {}'.format(total_items, time.clock() - total_time)

    num_high = len(image_similarity.similarity_clusters["high"])
    num_med = len(image_similarity.similarity_clusters["medium"])

    print 'found {} high {} medium {} total'.format(num_high, num_med, num_high+num_med)

    job['data'] = image_similarity.to_json()
    job['state'] = 'processed'


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message, channels=['similarity'])
    dispatcher.start()
