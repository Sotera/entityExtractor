#ENV vars that should be set and what they default to if they are not
#CAFFE_HOME = '/home/caffe_user/caffe/'
#CAFFE_MODEL_PATH = '/home/caffe-user/caffe/models/bvlc_reference_caffenet/'
#CAFFE_MODEL = bvlc_reference_caffenet.caffemodel
#CAFFE_PYTHON_PATH = /home/caffe-user/caffe/python/

import sys
import caffe_feature_extraction
import json
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher
from image_fetcher import fetch_image


def validate_job(job):
    if 'urls' not in job:
        return 'Missing "urls" required field'
    return None


def process_message(key, job):
    caffe_root = os.getenv('CAFFE_HOME', '/home/caffe-user/caffe/')

    if not job:
        print 'No Valid Job.'
        return

    error = validate_job(job)
    if error:
        print 'Error in Job : {}'.format(error)
        job['data'] = []
        job['error'] = error
        job['state'] = 'error'
        return

    image_path = None

    job_urls = job['urls'].split(',')

    image_url = None
    for url in job_urls:
        if url is None: continue

        image_path = fetch_image(url)

        if image_path:
            break

    if image_path is None:
        job['state'] = 'processed'
        job['data'] = []
        return

    # get features:
    print 'GETTING FEATURES'
    features = caffe_feature_extraction.get_all_features_in_path(caffe_root, image_path)
    if not features:
        print 'INVALID IMAGE OR DIRECTORY PATH'
        job['state'] = 'error'
        job['error'] = 'invalid image or directory path'
        return
    print 'FINISHED FEATURE PROCESSING'
    data = {
        'features': features,
        'url': image_url
    }
    job['data'] = json.dumps(data)
    job['state'] = 'processed'

    os.remove(image_path)

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
                            channels=['genie:feature_img'])
    dispatcher.start()
