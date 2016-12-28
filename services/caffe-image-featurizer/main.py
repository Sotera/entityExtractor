#ENV vars that should be set and what they default to if they are not
#CAFFE_HOME = '/home/caffe_user/caffe/'
#CAFFE_MODEL_PATH = '/home/caffe-user/caffe/models/bvlc_reference_caffenet/'
#CAFFE_MODEL = bvlc_reference_caffenet.caffemodel
#CAFFE_PYTHON_PATH = /home/caffe-user/caffe/python/

import sys, os
import caffe_feature_extraction
import json
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher

def validate_job(job):
    if 'image_path' not in job:
        return 'Missing "image_path" required field'

    image_path = job['image_path']
    if not (os.path.isfile(image_path)):
        return 'invalid path: %s' % image_path

    return None

def process_message(key, job):
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

    image_path = job['image_path']

    print image_path

    print 'GETTING FEATURES'

    try:
        features = caffe_feature_extraction.get_all_features_in_path(image_path)
    finally:
        os.remove(image_path)

    print 'FINISHED FEATURE PROCESSING'

    data = {'features': features}
    job['data'] = json.dumps(data)
    job['state'] = 'processed'

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
                            queues=['genie:feature_img'])
    dispatcher.start()
