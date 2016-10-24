#!/usr/bin/env python3

import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher
from aggregator import process

def validate_job(job):
    required = {'query_url', 'job_id', 'end_time_ms', 'max_time_lapse_ms',
        'result_url', 'similarity_threshold', 'data_type'}
    # 'lang' is optional

    if not required.issubset(job):
        return 'Missing some required fields {}'.format(required)

def process_message(key, job):
    error = validate_job(job)
    if error:
        print('Error in Job : {}'.format(error))
        job['data'] = []
        job['error'] = error
        job['state'] = 'error'
        return

    process(job)

    # directly updates db so no payload to pass back
    job['data'] = []
    job['state'] = 'processed'

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
                            channels=['genie:clust_agg'])
    dispatcher.start()
