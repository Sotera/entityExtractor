import sys
import json
from os import listdir, getenv
from os.path import isfile, join, dirname
sys.path.append(join(dirname(__file__), '../service'))
import caffe_feature_extraction

if __name__ == '__main__':
    image_path = '/downloads'
    image_data = {'feature_data':[]}

    for f in listdir(image_path):
        image_file = join(image_path, f)
        if isfile(image_file):
            features = caffe_feature_extraction.get_all_features_in_path(image_file)
            image_data['feature_data'].append({'image': image_file, 'features': features})
    with open(join(image_path, '/downloads/image_data.json'), 'w') as outfile:
        json.dump(image_data, outfile)
