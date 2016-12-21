# http://10.104.1.144:3003/api/socialMediaPosts/count?[where][timestamp_ms][between][0]=1469644000000&[where][timestamp_ms][between][1]=1469644050000&filter[where][lang]=en

# http://10.104.1.144:3003/api/socialMediaPosts?filter[where][timestamp_ms][between][0]=1469695563000&filter[where][timestamp_ms][between][1]=1469702566000&filter[where][lang]=en&filter[limit]=5&filter[skip]=0
# to test:
# from the redis cli run these commands
# hmset 1 'state' 'new' 'similarity_threshold' .5 'query_url' 'http://10.104.1.144:3003/api/socialMediaPosts/' 'lang' 'en' 'data_type' 'text' 'start_time_ms' 1469695563000 'end_time_ms' 1469702566000
# hmset 1 'state' 'new' 'similarity_threshold' .5 'es_host' '54.234.139.42' 'es_port' '9200' 'es_index' 'stream' 'es_doc_type' 'jul2016-uk' 'es_query' '{\'fields\':[\'timestamp_ms\',\'features\',\'id\'],\'query\':{\'bool\':{\'must\':{\'term\':{\'features\':0}},\'filter\':{\'range\':{\'timestamp_ms\':{\'gte\':\'1468617997000\',\'lt\':\'1468618897000\'}}}}}}'
# publish similarity 1

import sys, os
from feature_similarity import FeatureSimilarity
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher
from loopy import Loopy

def validate_job(job):
    required = {'similarity_threshold', 'start_time_ms', 'end_time_ms',
        'job_id', 'result_url', 'query_url', 'data_type'}
    # 'lang' is optional
    if job['start_time_ms'] > job['end_time_ms']:
        return 'start_time_ms > end_time_ms'

    if not required.issubset(job):
        return 'Missing some required fields {}'.format(required)

def process_message(key, job):
    print 'FINDING SIMILARITY'
    error = validate_job(job)
    if error:
        print 'Error in Job : {}'.format(error)
        job['data'] = []
        job['error'] = error
        job['state'] = 'error'
        return

    feature_similarity = FeatureSimilarity(float(job['similarity_threshold']), job['start_time_ms'], job['end_time_ms'])
    query_params = [{
        'query_type': 'between',
        'property_name': 'timestamp_ms',
        'query_value': [job['start_time_ms'], job['end_time_ms']]
    }]
    if 'lang' in job:
        query_params.append({
            'query_type': 'where',
            'property_name': 'lang',
            'query_value': job['lang']
        })

    loopy = Loopy(job['query_url'], query_params)

    if loopy.result_count == 0:
        print 'No data to process'
        job['data'] = []
        job['error'] = 'No data found to process.'
        job['state'] = 'error'
        return

    while True:
        print 'Scrolling...{}'.format(loopy.total_returned)
        page = loopy.get_next_page()
        if page is None:
            break
        # Do something with the obtained page
        for doc in page:
            if job['data_type'] == 'text' and 'text_features' in doc and 'id' in doc and \
                    len(doc['text_features']) > 0:
                feature_similarity.process_vector(doc['id'], doc['post_id'], doc['text_features'])
                continue
            if job['data_type'] == 'image' and 'image_features' in doc and 'id' in doc and \
                    len(doc['image_features']) > 0 and 'primary_image_url' in doc.keys() and \
                    doc['primary_image_url'] is not None:
                feature_similarity.process_vector(doc['id'], doc['post_id'], doc['image_features'],
                                                  doc['primary_image_url'])

    if 'TRUNCATE_POSTS' in os.environ and os.environ['TRUNCATE_POSTS'] == '1':
        print 'Truncating posts...'
        print delete_noise(feature_similarity.get_clusters_to_delete(), loopy)
    else:
        print 'Skipping truncate posts because TRUNCATE_POSTS env var is not set...'

    clusters = feature_similarity.get_clusters()

    print 'FINISHED SIMILARITY PROCESSING: found {} clusters'.format(len(clusters))
    for cluster in clusters:
        cluster['job_monitor_id'] = job['job_id']
        cluster['data_type'] = job['data_type']
        loopy.post_result(job['result_url'], cluster)
    job['data'] = feature_similarity.to_json()
    job['state'] = 'processed'


def delete_noise(noise_clusters, loopy):
    deletable_ids = []
    for delete_cluster in noise_clusters:
        deletable_ids.extend(delete_cluster.similar_ids)
    return loopy.post_result('/destroy', {'ids': deletable_ids})

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
                            queues=['genie:clust_txt', 'genie:clust_img'])
    dispatcher.start()
