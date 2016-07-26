

import redis
import threading
import time
import os


class Worker(threading.Thread):
    def __init__(self, redis_send, message):
        threading.Thread.__init__(self)
        self.send = redis_send
        self.item = message

    def run(self):
        # import pdb; pdb.set_trace()
        key = self.item['data']
        if key == 1:  # subscribe response
            print 'SUBSCRIBED BEHAVIOR'
            return
        # get object for corresponding item:
        obj = self.send.hgetall(key)
        if not obj:
            self.send.hmset(key, {'state': 'error', 'error': 'could not find item in redis'})
            print 'COULD NOT FIND ITEM IN REDIS'
            return
        print obj
        print type(obj)
        obj_dict = obj
        if obj_dict['state'] != 'new':  # not yet ready
            print 'NOT YET DOWNLOADED'
            return

        start_time = time.time()
        # try:
        obj_dict['state'] = 'processing'
        self.send.hmset(key, obj_dict)

        # get features:
        print 'FINDING SIMILARITY'
        # do the work to find similarity
        print 'FINISHED SIMILARITY PROCESSING'
        #obj_dict['data'] = similarity_data
        obj_dict['state'] = 'processed'
        # report features to redis
        self.send.hmset(key, obj_dict)


class Listener(threading.Thread):
    def __init__(self, redis_receive, redis_send, channels):
        threading.Thread.__init__(self)
        self.redis_receive = redis_receive
        self.redis_send = redis_send
        self.pubsub_receive = self.redis_receive.pubsub()
        self.pubsub_receive.subscribe(channels)

    def run(self):
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

# pickle.load(open('kmeans.pickle', 'rb'))

if __name__ == "__main__":
    pool = redis.ConnectionPool(host='redis', port=6379)
    r1 = redis.Redis(connection_pool=pool)
    r2 = redis.Redis(connection_pool=pool)
    client = Listener(r1, r2, ['similarity'])
    client.start()
