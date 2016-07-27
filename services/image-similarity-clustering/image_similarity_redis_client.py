
#to test:
    #from the redis cli run these commands
    #hmset 1 "state" "new" "similarity_threshold" .5 "es_host" "54.234.139.42" "es_port" "9200" "es_index" "stream" "es_doc_type" "jul2016-uk" "es_query" "{\"fields\":[\"timestamp_ms\",\"features\",\"id\"],\"query\":{\"bool\":{\"must\":{\"term\":{\"features\":0}},\"filter\":{\"range\":{\"timestamp_ms\":{\"gte\":\"1468617997000\",\"lt\":\"1468618897000\"}}}}}}"
    #publish similarity 1

import redis
import time
import json
from image_similarity import ImageSimilarity
from elasticsearch import Elasticsearch


class Worker:
    def __init__(self, redis_send, message):
        self.send = redis_send
        self.item = message

    def start(self):
        key = self.item['data']
        if key == 1:  # subscribe response
            print 'SUBSCRIBED TO CHANNEL'
            return
        # get object for corresponding item:
        job = self.send.hgetall(key)
        if not job:
            self.send.hmset(key, {'state': 'error', 'error': 'could not find item in redis'})
            print 'COULD NOT FIND ITEM IN REDIS'
            return
        if job['state'] != 'new':  # not yet ready
            print 'NOT YET FINISHED'
            return

        start_time = time.time()
        job['state'] = 'processing'
        self.send.hmset(key, job)
        self.process_message(key, job)

    def process_message(self, key, job):
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
        # report features to redis
        self.send.hmset(key, job)


class Listener():
    def __init__(self, redis_receive, redis_send, channels):
        self.redis_receive = redis_receive
        self.redis_send = redis_send
        self.pubsub_receive = self.redis_receive.pubsub()
        self.pubsub_receive.subscribe(channels)

    def start(self):
        # listen for messages and do work:
        for item in self.pubsub_receive.listen():
            print 'MESSAGE HEARD'
            if item['data'] == "KILL":
                self.pubsub_receive.unsubscribe()
                print self, "un-subscribed and finished"
                break
            else:
                worker = Worker(self.redis_send, item)
                worker.start()


if __name__ == "__main__":
    pool = redis.ConnectionPool(host='redis', port=6379)
    r1 = redis.Redis(connection_pool=pool)
    r2 = redis.Redis(connection_pool=pool)
    client = Listener(r1, r2, ['similarity'])
    client.start()

