import sys, os, json
from cluster_linker import ClusterLinker
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher
from loopy import Loopy


def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg


def err_check(job):
    required = {'query_url', 'start_time_ms', 'end_time_ms', 'result_url', 'job_id'}
    if not required.issubset(job):
        set_err(job, 'Missing some required fields {}'.format(required))


def process_message(key, job):
    err_check(job)
    if job['state'] == 'error':
        return

    query_url = os.getenv('QUERY_URL', job['query_url'])
    result_url = os.getenv('RESULT_URL', job['result_url'])

    query_params = [{
        'query_type': 'where',
        'property_name': 'end_time_ms',
        'query_value': job['end_time_ms']
    }]

    print 'BEGIN LINKING CLUSTERS'
    linker = ClusterLinker(job.get('min_overlap', 0.6))
    loopy = Loopy(query_url, query_params)

    if loopy.result_count == 0:
        print 'No data to process'
        job['data'] = []
        job['error'] = 'No data found to process.'
        job['state'] = 'error'
        return

    while True:
        print 'Scrolling...{}'.format(loopy.current_page)
        page = loopy.get_next_page()
        if page is None:
            break
        # Do something with the obtained page
        for doc in page:
            linker.add_cluster(doc)

    print 'FINISHED LINKING CLUSTERS'
    print 'SENDING LINKS'
    for link in linker.get_links():
        loopy.post_result(result_url, link)

    job['data'] = json.dumps({})  # no need to save anything to job
    job['state'] = 'processed'
    print 'FINISHED SENDING LINKS'
    print 'LINKING COMPLETE'
if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            queues=['genie:linker'])
    dispatcher.start()
    # process_message('abc', {'state':'new', 'job_id':'13', 'start_time_ms':1570916185000, 'end_time_ms':1570916187000, 'query_url':'http://172.17.0.1:3003/api/postsclusters/', 'result_url':'http://172.17.0.1:3003/clusterlinks/'})
