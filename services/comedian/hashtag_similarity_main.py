import sys, os
import json
from hashtag_similarity import HashtagClusters
from elasticsearch import Elasticsearch
sys.path.append(os.path.join(os.path.dirname(__file__), "./util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def process_message(key, job):
    if 'query_url' not in job.keys():
        set_err(job, "No 'query_url' in job fields")
    if 'start_time_ms' not in job.keys():
        set_err(job, "No 'start_time_ms' in job fields")
    if 'end_time_ms' not in job.keys():
        set_err(job, "No 'end_time_ms' in job fields")
    if 'result_url' not in job.keys():
        set_err(job, "No 'result_url' in job fields")
    if 'job_id' not in job.keys():
        set_err(job, "No 'job_id' in job fields")

    print 'FINDING SIMILARITY'
    hash_clust = HashtagClusters(float(job['min_post']))

    loopy = Loopy(job['query_url'], [
        {
            "query_type": "between",
            "property_name": "timestamp_ms",
            "query_value": [job['start_time_ms'], job['end_time_ms']]
        },
        {
            "query_type": "where",
            "property_name": "lang",
            "query_value": "en"
        }
    ])

    if loopy.result_count == 0:
        print "No data to process"
        job['data'] = []
        job['error'] = "No data found to process."
        job['state'] = 'error'
        return

    while True:
        print "Scrolling...{}".format(loopy.current_page)
        page = loopy.get_next_page()
        if page is None:
            break
        # Do something with the obtained page
        for doc in page:
            hash_clust.process_vector(doc['fields']['id'][0], doc['fields']['features'])

    print 'FINISHED SIMILARITY PROCESSING'
    clusters = hash_clust.to_json()
    for cluster in clusters:
        cluster['job_monitor_id'] = job['job_id']
        loopy.post_result(job['result_url'], cluster)

    job['data'] = hash_clust.to_json()
    job['state'] = 'processed'

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
        process_func=process_message,
        channels=['genie:clust_hash'])
    dispatcher.start()

