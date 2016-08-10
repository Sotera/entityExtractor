# http://10.104.1.144:3003/api/socialMediaPosts/count?[where][timestamp_ms][between][0]=1469644000000&[where][timestamp_ms][between][1]=1469644050000&filter[where][lang]=en

# http://10.104.1.144:3003/api/socialMediaPosts?filter[where][timestamp_ms][between][0]=1469695563000&filter[where][timestamp_ms][between][1]=1469702566000&filter[where][lang]=en&filter[limit]=5&filter[skip]=0
# to test:
# from the redis cli run these commands
# hmset 1 "state" "new" "similarity_threshold" .5 "similarity_method" "custom" "query_url" "http://10.104.1.144:3003/api/socialMediaPosts/" "lang" "en" "data_type" "text" "start_time_ms" 1469695563000 "end_time_ms" 1469702566000
# hmset 1 "state" "new" "similarity_threshold" .5 "es_host" "54.234.139.42" "similarity_method" "custom" "es_port" "9200" "es_index" "stream" "es_doc_type" "jul2016-uk" "es_query" "{\"fields\":[\"timestamp_ms\",\"features\",\"id\"],\"query\":{\"bool\":{\"must\":{\"term\":{\"features\":0}},\"filter\":{\"range\":{\"timestamp_ms\":{\"gte\":\"1468617997000\",\"lt\":\"1468618897000\"}}}}}}"
# publish similarity 1

import sys
import os
from image_similarity import ImageSimilarity

sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy


def process_message(key, job):
    # get features:
    print 'FINDING SIMILARITY'
    # do the work to find similarity
    image_similarity = ImageSimilarity(float(job['similarity_threshold']), job['start_time_ms'], job['end_time_ms'],
                                       job['similarity_method'])
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
            if job['data_type'] == "text" and 'text_features' in doc and 'id' in doc and \
                    len(doc['text_features']) > 0:
                image_similarity.process_vector(doc['id'], doc['text_features'])
                continue
            if job['data_type'] == "image" and 'image_features' in doc and 'id' in doc and \
                    len(doc['image_features']) > 0:
                image_similarity.process_vector(doc['id'], doc['image_features'])

    clusters = image_similarity.get_clusters()

    print 'FINISHED SIMILARITY PROCESSING: found {} clusters'.format(len(clusters))
    for cluster in clusters:
        cluster['job_monitor_id'] = job['job_id']
        loopy.post_result(job['result_url'], cluster)
    job['data'] = image_similarity.to_json()
    job['state'] = 'processed'


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
                            channels=['genie:clust_txt', 'genie:clust_img'])
    dispatcher.start()
