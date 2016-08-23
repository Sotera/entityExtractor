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
        return results[0].tolist()

    except Exception as e:
        print e
        return [-1]


def remove_file(file):
    os.remove(file)


def get_all_features_in_path(caffe_root_path, image_dir_path):
    if not (os.path.isfile(image_dir_path)):
        return None

    start_time = time.time()

    global featurizer # re-use on successive runs

    featurizer = CaffeFeaturizer(caffe_root_path)

    features = get_caffe_features(image_dir_path)

    print "------------------ %f minutes elapsed ------------------------" % ((time.time() - start_time)/60.0)

    return dump(features)
