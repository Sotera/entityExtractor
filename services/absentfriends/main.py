import sys, os, codecs, uuid
from urlparse import urlparse
from domain_similarity import DomainClusters
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy

UNICODE_PERIOD = u'.'

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    if 'result_url' not in job.keys():
        set_err(job, "No 'result_url' in job fields")
    if 'query_url' not in job.keys():
        set_err(job, "No 'query_url' in job fields")
    if 'start_time_ms' not in job.keys():
        set_err(job, "No 'start_time_ms' in job fields")
    if 'end_time_ms' not in job.keys():
        set_err(job, "No 'end_time_ms' in job fields")
    if 'job_id' not in job.keys():
        set_err(job, "No 'job_id' in job fields")
    if 'min_post' not in job.keys():
        set_err(job, "No 'min_post' in job fields")

# Turn IDNA encoded international domain name parts back into unicode strings
# TODO: Delete this or use it, it is not clear if we will see IDNA encoded URLs in our data sources.
# This routine is here as reference material at this time.
def reverse_idna(A):
    n = len(A)
    for i in range(n):
        if len(A[i]) > 4:
            if A[i][0:4] == u"xn--":
                A[i] = codecs.decode(A[i].encode("ascii"), "idna")
    return A

# TODO:  Maybe add urlparse(...).path element and urlparse(...).query subelements to the set of things to cluster on?
def get_domains(urlList):
    result = set([])
    for url in urlList:
        if 'expanded_url' in url and url['expanded_url'] is not None:
            parsed_url = urlparse( url['expanded_url'] )
            A = parsed_url.netloc.split(UNICODE_PERIOD)
            if len(A) > 2:
                A = A[1:]
            dn = UNICODE_PERIOD.join(A)
            result.add(dn)

    return list(result)

def process_message(key, job):
    print "absentfriends/main.py:process_message" + repr((key, job))
    # if type == 'featurizer', immediately process and return b/c domains
    # are not featurized. allows system to continue with clustering process.
    if job.get('type') == 'featurizer':
        job['state'] = 'processed'
        job['data'] = []
        return

    err_check(job)
    if job['state'] == 'error':
        return

    query_url = os.getenv('QUERY_URL', job['query_url'])
    result_url = os.getenv('RESULT_URL', job['result_url'])

    print 'FINDING SIMILARITY'
    print 'min_post set to %s' % job['min_post']
    domain_clust = DomainClusters(float(job['min_post']), query_url, job['start_time_ms'])

    query_params = [{
        "query_type": "between",
        "property_name": "timestamp_ms",
        "query_value": [job['start_time_ms'], job['end_time_ms']]
    }, {
        "query_type": "where",
        "property_name": "featurizer",
        "query_value": "domain"
    }]

    loopy = Loopy(query_url , query_params)

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
            domains = get_domains(doc['image_urls'])
            if len(domains) > 0:
                domain_clust.process_vector(doc['id'], doc['post_id'], domains)

    if int(os.getenv('TRUNCATE_POSTS') or 0):
        print 'Truncating posts...'
        print truncate_posts(feature_similarity.get_clusters_to_delete(), loopy)
    else:
        print 'Skipping truncate posts because TRUNCATE_POSTS env var is not set...'

    print 'FINISHED SIMILARITY PROCESSING'
    for k, v in domain_clust.get_clusters().iteritems():
        cluster = {}
        cluster['id'] = str(uuid.uuid4())
        cluster['term'] = k
        cluster['similar_ids'] = v['similar_ids']
        cluster['similar_post_ids'] = v['similar_post_ids']
        cluster['job_monitor_id'] = job['job_id']
        cluster['start_time_ms'] = job['start_time_ms']
        cluster['end_time_ms'] = job['end_time_ms']
        cluster['stats'] = v['stats']
        cluster['data_type'] = 'domain'

        try:
            loopy.post_result(result_url, cluster)
        except Exception as e:
            # TODO: we should set data = None when error.
            job['data'] = []
            job['state'] = 'error'
            job['error'] = e
            break
    else: # no errors
        job['data'] = domain_clust.to_json()
        job['state'] = 'processed'


def truncate_posts(deletable_ids, loopy):
    return loopy.post_result('/destroy', {'ids': deletable_ids})

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            queues=['genie:feature_domain', 'genie:clust_domain'])
    dispatcher.start()
