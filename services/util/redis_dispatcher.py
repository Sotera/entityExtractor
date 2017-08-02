'''
What does this module do?
1. Receives job params from a Redis list.
2. Kicks off a client-defined long-running job.
3. Updates redis hash when job completes.
'''

from __future__ import print_function
from os import getenv
import redis, sys, traceback

'''
Fetch job data and call processing function
'''
class Worker(object):
    def __init__(self, redis_client):
        self.send = redis_client

    '''
    run worker with given msg and args
    '''
    def run(self, msg, **kwargs):
        print(msg)
        key = msg[1]
        initial_state = kwargs.get('initial_state', 'new')
        process_func = kwargs.get('process_func',
            lambda key, job: sys.stdout.write('processing placeholder'))

        # get object for corresponding key:
        job = self.send.hgetall(key)
        print(job)

        if not job:
            self.send.hmset(key,
                {'state': 'error', 'error': 'could not find item in redis'})
            print('COULD NOT FIND ITEM IN REDIS')
            return
        # for dupe publishings. job already running.
        if job['state'] != initial_state:
            print('NOT YET FINISHED')
            return

        job['state'] = 'processing'

        # reset results (if job was re-run).
        for k in ('error', 'data'):
            job.pop(k, None)

        # update with new state
        self.send.hmset(key, job)

        try:
            process_func(key, job)
        except Exception as e:
            job['state'] = 'error'
            job['error'] = e
            print(e)
            traceback.print_exc()
        # when done, update job
        self.send.hmset(key, job)

'''
Listen for job params and dispatch workers.
'''
class Dispatcher(object):
    '''
    Args:
        queue: redis list to pull jobs from
        process_func: a blocking function with args: key (string), job (dict)
        initial_state: of redis job. ex. 'new'
    '''
    def __init__(self, redis_host=None, redis_port=None, **kwargs):
        self.redis_host = redis_host or getenv('REDIS_HOST', 'redis')
        self.redis_port = redis_port or getenv('REDIS_PORT', 6379)
        print('redis conf:', self.redis_host, self.redis_port)
        self.queues = kwargs['queues']
        self.process_func = kwargs['process_func']
        self.initial_state = kwargs.get('initial_state', 'new')

    def start(self):
        # decode_responses: retain char encoding from publisher
        pool = redis.ConnectionPool(host=self.redis_host,
            port=self.redis_port, decode_responses=True)
        redis_client = redis.Redis(connection_pool=pool)
        try:
            # test connection
            redis_client.ping()
        except redis.exceptions.ConnectionError as rexc:
            print('''
            Cannot connect to host "{host}" port {port}.
            Perhaps add "{host}" to /etc/hosts in dev env.
            '''.format(host=self.redis_host, port=self.redis_port))
            print(rexc)
            return
        print('WATCHING QUEUES %s' % self.queues)
        while True:
            try:
                # block for 10 sec and reset (don't block forever).
                item = redis_client.brpop(self.queues, 10)
                if item:
                    print('MESSAGE HEARD')
                    worker = Worker(redis_client)
                    worker.run(item, process_func=self.process_func,
                        initial_state=self.initial_state)
            except Exception as e:
                print('error running redis worker:', e)
                traceback.print_exc()
