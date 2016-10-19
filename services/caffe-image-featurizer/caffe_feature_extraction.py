import time
# import os
# import json

from functools import partial
from caffe_featurizer import CaffeFeaturizer

featurizer = CaffeFeaturizer()

# def create_dictionary(subdir, file_i):
#     file_full_path = os.path.join(subdir, file_i)
#     file_dictionary = {'name': file_full_path}
#     print '----SERIALIZING----'
#     return json.dumps(file_dictionary)

# def convert_files_to_dictionary(image_dir_path):
#     try:

#         if os.path.isfile(image_dir_path):
#             file_dictionary = {'name': image_dir_path}
#             return [json.dumps(file_dictionary)]
#         elif os.path.isdir(image_dir_path):
#             for subdir, dirs, files in os.walk(image_dir_path):
#                 func = partial(create_dictionary, subdir)
#                 return map(func, files)
#     except Exception as e:
#         print 'ERROR:', e
#         return []

#     return []

def get_caffe_features(file_path):
    try:
        featurizer.set_batch_size(1)
        featurizer.set_files([file_path])
        featurizer.load_files()
        featurizer.forward()

        results = featurizer.featurize()
        return results[0].tolist()
    except Exception as e:
        print 'ERROR:', e
        return [-1]

def get_all_features_in_path(image_path):
    start_time = time.time()

    features = get_caffe_features(image_path)

    end_time = time.time() - start_time
    print "------------------ %f seconds elapsed ------------------------" % end_time

    return features
