#ENV vars that should be set and what they default to if they are not
#CAFFE_HOME = '/home/caffe_user/caffe/'
#CAFFE_MODEL_PATH = '/home/caffe-user/caffe/models/bvlc_reference_caffenet/'
#CAFFE_MODEL = bvlc_reference_caffenet.caffemodel
#CAFFE_PYTHON_PATH = /home/caffe-user/caffe/python/

import redis
import caffe_feature_extraction
import time
import os


class Worker():
    def __init__(self, redis_send, message):
        self.send = redis_send
        self.item = message
        self.caffe_root = os.getenv('CAFFE_HOME', '/home/caffe-user/caffe/')

    def start(self):
        key = self.item['data']
        if key == 1:  # subscribe response
            print 'SUBSCRIBED TO CHANNEL'
            return
        # get object in db corresponding to pub msg:
        job = self.send.hgetall(key)
        if not job:
            self.send.hmset(key, {'state': 'error', 'error': 'could not find item in redis'})
            print 'COULD NOT FIND ITEM IN REDIS'
            return
        if job['state'] != 'downloaded':  # not yet ready
            print 'NOT YET DOWNLOADED'
            return
        image_dir_path = job['path']
        job['state'] = 'processing'
        self.send.hmset(key, job)

        # get features:
        print 'GETTING FEATURES'
        features = caffe_feature_extraction.get_all_features_in_path(self.caffe_root, image_dir_path)
        if not features:
            print 'INVALID IMAGE OR DIRECTORY PATH'
            self.send.hmset(key, {'state': 'error', 'error': 'invalid image or directory path'})
            return
        print 'FINISHED FEATURE PROCESSING'
        job['data'] = features
        job['state'] = 'processed'
        # save features to redis
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
            if item['data'] == 'KILL':
                self.pubsub_receive.unsubscribe()
                print self, 'un-subscribed and finished'
                break
            else:
                worker = Worker(self.redis_send, item)
                worker.start()


if __name__ == '__main__':
    pool = redis.ConnectionPool(host='redis', port=6379)
    r1, r2 = redis.Redis(connection_pool=pool), redis.Redis(connection_pool=pool)
    client = Listener(r1, r2, ['features'])
    client.start()
