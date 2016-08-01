'''
1. Create redis pubsub client.
2. Update redis hash when job completes.
'''
import redis, sys

'''
Fetch job data and call processing function
'''
class Worker(object):
    def __init__(self, redis_store):
        self.send = redis_store

    def run(self, item, **kwargs):
        key = item['data']
        initial_state = kwargs.get('initial_state', 'new')
        process_func = kwargs.get('process_func',
            lambda: sys.stdout.write('processing placeholder'))

        # get object for corresponding item:
        job = self.send.hgetall(key)
        print job
        print key
        if not job:
            self.send.hmset(key, {'state': 'error', 'error': 'could not find item in redis'})
            print 'COULD NOT FIND ITEM IN REDIS'
            return
        if job['state'] != initial_state:  # not yet ready
            print 'NOT YET FINISHED'
            return

        job['state'] = 'processing'
        # update with new state
        self.send.hmset(key, job)
        process_func(key, job)
        # when done, update job
        self.send.hmset(key, job)


'''
Listen for messages and dispatch workers.
1 worker per message for parallelization support (TODO).
'''
class Dispatcher(object):
    '''
    Args:
        channels: list of channel names
        process_func: a blocking function with args: key (string), job (dict)
        initial_state: of redis job. ex. 'new'
    '''
    def __init__(self, redis_host='localhost', redis_port=6379, **kwargs):
        self.redis_host = redis_host
        self.redis_port = redis_port
        self.channels = kwargs['channels']
        self.process_func = kwargs['process_func']
        self.initial_state = kwargs.get('initial_state', 'new')

    def start(self):
        pool = redis.ConnectionPool(host=self.redis_host, port=self.redis_port)
        redis_subscriber = redis.Redis(connection_pool=pool)
        redis_store = redis.Redis(connection_pool=pool)
        pubsub = redis_subscriber.pubsub()
        pubsub.subscribe(self.channels)
        # listen for messages and do work:
        for item in pubsub.listen():
            print 'MESSAGE HEARD'
            key = item['data']
            if key == 1: # subscribe response
                print 'SUBSCRIBED TO CHANNEL'
            elif item['data'] == 'KILL':
                pubsub.unsubscribe()
                print 'un-subscribed and finished'
                break
            else:
                worker = Worker(redis_store)
                try:
                    worker.run(item, process_func=self.process_func, initial_state=self.initial_state)
                except Exception as e:
                    print 'error running redis worker:', e
