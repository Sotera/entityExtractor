# http://10.104.1.144:3003/api/socialMediaPosts/count?[where][timestamp_ms][between][0]=1469644000000&[where][timestamp_ms][between][1]=1469644050000&filter[where][lang]=en

# http://10.104.1.144:3003/api/socialMediaPosts?filter[where][timestamp_ms][between][0]=1469695563000&filter[where][timestamp_ms][between][1]=1469702566000&filter[where][lang]=en&filter[limit]=5&filter[skip]=0
# to test:
# from the redis cli run these commands
# hmset 1 "state" "new" "similarity_threshold" .5 "query_url" "http://10.104.1.144:3003/api/socialMediaPosts/" "lang" "en" "data_type" "text" "start_time_ms" 1469695563000 "end_time_ms" 1469702566000
# hmset 1 "state" "new" "similarity_threshold" .5 "es_host" "54.234.139.42" "es_port" "9200" "es_index" "stream" "es_doc_type" "jul2016-uk" "es_query" "{\"fields\":[\"timestamp_ms\",\"features\",\"id\"],\"query\":{\"bool\":{\"must\":{\"term\":{\"features\":0}},\"filter\":{\"range\":{\"timestamp_ms\":{\"gte\":\"1468617997000\",\"lt\":\"1468618897000\"}}}}}}"
# publish similarity 1

import sys
import os
from feature_similarity import FeatureSimilarity

sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy


def validate_job(job):
    if 'similarity_threshold' not in job.keys():
        return "No similarity_threshold."
    if 'start_time_ms' not in job.keys():
        return "No start_time_ms."
    if 'end_time_ms' not in job.keys():
        return "No end_time_ms."
    if 'job_id' not in job.keys():
        return "No job_id."
    if 'result_url' not in job.keys():
        return "No result_url."
    if 'query_url' not in job.keys():
        return "No query_url."
    if job['start_time_ms'] > job['end_time_ms']:
        return "start_time_ms > end_time_ms"
    return None


def get_aggregate_clusters_loopy(job):
    query_params = [{
            "query_type": "where",
            "property_name": "active",
            "query_value": True
        },
        {
            "query_type": "where",
            "property_name": "data_type",
            "query_value": job['data_type']
        }
    ]

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
        return None

    return loopy


def get_aggregate_clusters(loopy):
    aggregate_clusters = []
    while True:
        print "Scrolling...{}".format(loopy.current_page)
        page = loopy.get_next_page()
        if page is None:
            break
        aggregate_clusters.extend(page)
    return aggregate_clusters


def get_post_clusters_loopy(job):
    query_params = [{
        "query_type": "between",
        "property_name": "timestamp_ms",
        "query_value": [job['start_time_ms'], job['end_time_ms']]
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
        return None

    return loopy


def process_message(key, job):
    # get features:
    print 'AGGREGATING CLUSTERS'
    # do the work to find similarity
    error = validate_job(job)
    if error is not None:
        print "Error in Job : {}".format(error)
        job['data'] = []
        job['error'] = error
        job['state'] = 'error'
        return

    aggregate_clusters_loopy = get_aggregate_clusters_loopy(job)
    if aggregate_clusters_loopy is None:
        return
    aggregate_clusters = get_aggregate_clusters(aggregate_clusters_loopy)

    post_clusters_loopy = get_post_clusters_loopy(job)
    if post_clusters_loopy is None:
        return

    while True:
        print "Scrolling...{}".format(post_clusters_loopy.current_page)
        page = post_clusters_loopy.get_next_page()
        if page is None:
            break
        # Do something with the obtained page
        for doc in page:
            for aggregate_cluster in aggregate_clusters:
                print "check for similarity"
                print "if similar, update agg cluster (end date and avg sim vec) and continue"
                #post_clusters_loopy.post_result(job['result_url'], cluster)

    job['state'] = 'processed'


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
                            channels=['genie:clust_txt', 'genie:clust_img'])
    dispatcher.start()
