import sys, os
from hashtag_similarity import HashtagClusters
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
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

def process_message(key, job):
    if 'type' in job and job['type'] == 'featurizer':
        job['state'] = 'processed'
        return

    print 'Checking Parameters'
    err_check(job)
    if job['state'] == 'error':
        return

    print 'FINDING SIMILARITY'
    hash_clust = HashtagClusters(float(job['min_post']))

    query_params = [{
        "query_type": "between",
        "property_name": "timestamp_ms",
        "query_value": [job['start_time_ms'], job['end_time_ms']]
    }, {
        "query_type": "neq",
        "property_name": "hashtags",
        "query_value": "null"
    }]

    if 'lang' in job.keys():
        query_params.append({
            "query_type": "where",
            "property_name": "lang",
            "query_value": job['lang']
        })
    loopy = Loopy(job['query_url'], query_params)

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
            hash_clust.process_vector(doc['id'], doc['hashtags'])

    print 'FINISHED SIMILARITY PROCESSING'
    for k, v in hash_clust.hash_groups.iteritems():
        cluster = {}
        cluster['term'] = k
        cluster['post_ids'] = v
        cluster['job_monitor_id'] = job['job_id']
        loopy.post_result(job['result_url'], cluster)

    job['data'] = hash_clust.to_json()
    job['state'] = 'processed'

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            channels=['genie:feature_hash', 'genie:clust_hash'])
    dispatcher.start()

