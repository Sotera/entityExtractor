#!/usr/bin/env python3

import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher
from mongo_spark_client import Client as MongoSpark
from score_text import Scorer

# reusable client
mongo_spark = MongoSpark()
mongo_spark.collection = 'scoredText'
scorer = Scorer(mongo_spark)

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    required = {'id'}
    if not required.issubset(job):
        set_err(job, 'Missing some required fields {}'.format(required))

def process_message(key, job):
    err_check(job)
    if job['state'] == 'error':
        return

    scorer.score(job['id'])

    # nothing to save
    job['data'] = []
    job['state'] = 'processed'

dispatcher = Dispatcher(redis_host='redis',
                        process_func=process_message,
                        queues=['genie:indications'])
dispatcher.start()
