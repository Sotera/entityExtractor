#!/usr/bin/env python3

import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher
from aggregator import process

def validate_job(job):
    required = {'query_url', 'job_id', 'end_time_ms', 'max_time_lapse_ms',
        'result_url', 'similarity_threshold'}
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


# http://10.104.1.144:3003/api/socialMediaPosts/count?[where][timestamp_ms][between][0]=1469644000000&[where][timestamp_ms][between][1]=1469644050000&filter[where][lang]=en

# http://10.104.1.144:3003/api/socialMediaPosts?filter[where][timestamp_ms][between][0]=1469695563000&filter[where][timestamp_ms][between][1]=1469702566000&filter[where][lang]=en&filter[limit]=5&filter[skip]=0
# to test:
# from the redis cli run these commands
# hmset 1 'state' 'new' 'similarity_threshold' .5 'query_url' 'http://10.104.1.144:3003/api/socialMediaPosts/' 'lang' 'en' 'data_type' 'text' 'start_time_ms' 1469695563000 'end_time_ms' 1469702566000
# hmset 1 'state' 'new' 'similarity_threshold' .5 'es_host' '54.234.139.42' 'es_port' '9200' 'es_index' 'stream' 'es_doc_type' 'jul2016-uk' 'es_query' '{\'fields\':[\'timestamp_ms\',\'features\',\'id\'],\'query\':{\'bool\':{\'must\':{\'term\':{\'features\':0}},\'filter\':{\'range\':{\'timestamp_ms\':{\'gte\':\'1468617997000\',\'lt\':\'1468618897000\'}}}}}}'
# publish similarity 1
