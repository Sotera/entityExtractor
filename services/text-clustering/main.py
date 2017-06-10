import sys, os, uuid
from entity_docs import EntityClusters
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    if 'query_url' not in job:
        set_err(job, "No 'query_url' in job fields")
    if 'result_url' not in job:
        set_err(job, "No 'result_url' in job fields")
    if 'start_time_ms' not in job:
        set_err(job, "No 'start_time_ms' in job fields")
    if 'end_time_ms' not in job:
        set_err(job, "No 'end_time_ms' in job fields")
    if 'job_id' not in job:
        set_err(job, "No 'job_id' in job fields")
    if 'min_post' not in job:
        set_err(job, "No 'min_post' in job fields")


def process_message(key, job):
    err_check(job)
    if job['state'] == 'error':
        return

    print 'FINDING SIMILARITY'
    print 'min_post set to %s' % job['min_post']
    text_clust = EntityClusters(float(job['min_post']), job['result_url'], job['start_time_ms'])

    query_params = [{
        "query_type": "between",
        "property_name": "timestamp_ms",
        "query_value": [job['start_time_ms'], job['end_time_ms']]
    }, {
        "query_type": "where",
        "property_name": "featurizer",
        "query_value": "text"
    }, {
        "query_type": "neq",
        "property_name": "text_features",
        "query_value": "null"
    }]

    loopy = Loopy(job['query_url'], query_params)

    if loopy.result_count == 0:
        print "No data to process"
        job['data'] = []
        job['error'] = "No data found to process."
        job['state'] = 'error'
        return

    while True:
        print "Scrolling...{}".format(loopy.total_returned)
        page = loopy.get_next_page()
        if page is None:
            break
        # Do something with the obtained page
        for doc in page:
            text_clust.process_vector(doc['id'], doc['post_id'], doc['text_features'])

    print 'FINISHED SIMILARITY PROCESSING'
    for k, v in text_clust.get_clusters().iteritems():
        cluster = {
            'id': str(uuid.uuid4()),
            'term': k,
            'similar_ids': v['similar_ids'],
            'similar_post_ids': v['similar_post_ids'],
            'job_monitor_id': job['job_id'],
            'start_time_ms': job['start_time_ms'],
            'end_time_ms': job['end_time_ms'],
            'stats': v['stats'],
            'data_type': 'text'
        }

        try:
            loopy.post_result(job['result_url'], cluster)
        except Exception as e:
            # TODO: we should set data = None when error.
            job['data'] = []
            job['state'] = 'error'
            job['error'] = e
            break
    else: # no errors
        job['data'] = text_clust.to_json()
        job['state'] = 'processed'


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            queues=['genie:clust_txt'])
    dispatcher.start()

