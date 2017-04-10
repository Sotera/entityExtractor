import sys, os, uuid
from mutual_information import MutualInformation
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
    # if type == 'featurizer', immediately process and return b/c the text nodes
    # are not featurized. allows system to continue with clustering process.
    if job.get('type') == 'featurizer':
        job['state'] = 'processed'
        job['data'] = []
        return

    # Check if the text language can be featurized
    err_check(job)
    if job['state'] == 'error':
        return

    query_url = os.environ['QUERY_URL'] if 'QUERY_URL' in os.environ else job['query_url']
    result_url = os.environ['RESULT_URL'] if 'RESULT_URL' in os.environ else job['result_url']

    print 'FINDING SIMILARITY'
    print 'min_post set to %s' % job['min_post']
    word_clust = MutualInformation(float(job['min_post']), result_url, job['start_time_ms'])

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
        "property_name": "text",
        "query_value": "null"
    }]

    if 'lang' in job:
        query_params.append({
            'query_type': 'where',
            'property_name': 'lang',
            'query_value': job['lang']
        })

    loopy = Loopy(query_url, query_params)
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
            word_clust.process_vector(doc['id'], doc['post_id'], doc['text'], doc['lang'])

    if int(os.getenv('TRUNCATE_POSTS') or 0):
        print 'Truncating posts...'
        print truncate_posts(word_clust.get_deletable_ids(), loopy)
    else:
        print 'Skipping truncate posts because TRUNCATE_POSTS env var is not set...'

    print 'FINISHED SIMILARITY PROCESSING'
    for k, v in word_clust.get_clusters().iteritems():
        cluster = {}
        cluster['id'] = str(uuid.uuid4())
        cluster['term'] = k
        cluster['similar_ids'] = v['similar_ids']
        cluster['similar_post_ids'] = v['similar_post_ids']
        cluster['job_monitor_id'] = job['job_id']
        cluster['start_time_ms'] = job['start_time_ms']
        cluster['end_time_ms'] = job['end_time_ms']
        cluster['stats'] = v['stats']
        cluster['data_type'] = 'text'

        try:
            loopy.post_result(result_url, cluster)
        except Exception as e:
            # TODO: we should set data = None when error.
            job['data'] = []
            job['state'] = 'error'
            job['error'] = e
            break
    else: # no errors
        job['data'] = word_clust.to_json()
        job['state'] = 'processed'

def truncate_posts(deletable_ids, loopy):
    return loopy.post_result('/destroy', {'ids': deletable_ids})

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
        queues=['genie:feature_txt', 'genie:clust_txt'])
    #dispatcher.start()

    job = {u'lang': u'en', u'job_id': u'58e67e7a246ad2001674f8f1', u'data_type': u'text', u'end_time_ms': u'1491500666818', u'similarity_threshold': u'0.65', u'start_time_ms': u'1491500366819', u'query_url': u'http://172.17.0.1:3003/api/socialmediaposts/', u'min_post': u'10', u'state': u'new', u'result_url': u'http://172.17.0.1:3003/api/postsclusters/'}
    process_message(1, job)