import os
import sys
import time
import argparse
import numpy as np
import json

from functools import partial
from caffe_featurizer import CaffeFeaturizer

CAFFE_ROOT = ''
featurizer = None

def create_dictionary(subdir, file_i):
    file_full_path = os.path.join(subdir, file_i)
    file_dictionary = {'name': file_full_path}
    print '----SERIALIZING----'
    return dump(file_dictionary)


def convert_files_to_dictionary(image_dir_path):
    try:

        if os.path.isfile(image_dir_path):
            file_dictionary = {'name': image_dir_path}
            return [dump(file_dictionary)]

        elif os.path.isdir(image_dir_path):
            for subdir, dirs, files in os.walk(image_dir_path):
                func = partial(create_dictionary, subdir)
                return map(func, files)

    except Exception as e:
        print e
        return []

    return []


def dump(obj):
    return json.dumps(obj)


def get_caffe_features(file_path):
    try:
        featurizer.set_batch_size(1)
        featurizer.set_files([file_path])
        featurizer.load_files()
        featurizer.forward()

        results = featurizer.featurize()
        return results.tolist()

    except Exception as e:
        print e
        return [-1]


def get_features(image_json_txt_obj):
    print '---------------PROCESSING IMAGE----------------'
    image_json_dict = json.loads(image_json_txt_obj)
    file_path = str(image_json_dict['name'])
    features = get_caffe_features(file_path)
    image_json_dict['features'] = features
    return image_json_dict


# def file_to_string(output_path):
#     fd = open(output_path)
#     arr = []
#     for line in fd:
#         arr.append(line)
#     return arr


def remove_file(file):
    os.remove(file)


def get_all_features_in_path(caffe_root_path, image_dir_path):
    if not (os.path.isdir(image_dir_path)) and not (os.path.isfile(image_dir_path)):
        return None

    start_time = time.time()

    global featurizer # re-use on successive runs

    featurizer = CaffeFeaturizer(caffe_root_path)

    file_paths = convert_files_to_dictionary(image_dir_path)
    # submit images to processing
    files_to_features = map(get_features, file_paths)

    print "------------------ %f minutes elapsed ------------------------" % ((time.time() - start_time)/60.0)

    return dump(files_to_features)


# For each image file submitted for processing,
# saves features and corresponding filename as json object
# ------------------------------------------
# NOTE: for each json object in output, check first element of "features" list for -1.
# If equals -1, then method was unable to extract features from the image
# def run_feature_extraction():
#     start_time = time.time()
#     desc = 'Feature Extraction for Images'
#     parser = argparse.ArgumentParser(
#         description=desc,
#         formatter_class=argparse.RawDescriptionHelpFormatter,
#         epilog=desc)

#     default_path = 'target_images'
#     parser.add_argument("--input_dir", help="input directory", default=default_path)
#     parser.add_argument("--output", help="output file", default='image_features')
#     parser.add_argument('--caffeRootDir', dest='caffeRootDir', action='store', help='root directory for caffe.')
#     args = parser.parse_args()

#     # serialize and put all images in rdd:
#     # use json schema:
#     #     "name": "",
#     #     "bytes": ""
#     #     "features": "[]"
#     image_dir_path = args.input_dir
#     data_arr = convert_files_to_dictionary(image_dir_path)

#     global CAFFE_ROOT
#     CAFFE_ROOT = args.caffeRootDir

#     sys.path.insert(0, CAFFE_ROOT + 'python')

#     global featurizer
#     featurizer = CaffeFeaturizer(CAFFE_ROOT)

#     # submit image rdd to processing
#     rdd_features = map(get_features, data_arr)
#     # save as txt file:
#     output = map(dump, rdd_features)
#     with open(args.output, 'w') as outfile:
#       json.dump(output, outfile)
#     print "------------------ %f minutes elapsed ------------------------" % ((time.time() - start_time)/60.0)

#     # helper fct to encapsulate:
#     # get_all_features_str(image_dir_path, args.output, start_time)


# if __name__ == '__main__':
#     run_feature_extraction()
