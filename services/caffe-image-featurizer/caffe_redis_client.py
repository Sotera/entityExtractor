#ENV vars that should be set and what they default to if they are not
#CAFFE_HOME = '/home/caffe_user/caffe/'
#CAFFE_MODEL_PATH = '/home/caffe-user/caffe/models/bvlc_reference_caffenet/'
#CAFFE_MODEL = bvlc_reference_caffenet.caffemodel
#CAFFE_PYTHON_PATH = /home/caffe-user/caffe/python/

import sys
import caffe_feature_extraction
import urllib2
import urllib
import json
from bs4 import BeautifulSoup
import os
import uuid
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher


def url_to_soup(url):
    hdr = {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.11 (KHTML, like Gecko) Chrome/23.0.1271.64 Safari/537.11',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Charset': 'ISO-8859-1,utf-8;q=0.7,*;q=0.3',
        'Accept-Encoding': 'none',
        'Accept-Language': 'en-US,en;q=0.8',
        'Connection': 'keep-alive'
    }
    req = urllib2.Request(url, headers=hdr)
    res = urllib2.build_opener(urllib2.HTTPCookieProcessor).open(req, timeout=4)
    return BeautifulSoup(res.read(), "html.parser")


def get_instagram_page_image(soup):
    l_meta = soup.head.find_all('meta')
    for m in l_meta:
        if m.has_attr('content'):
            ind = m['content'].find('jpg')
            if ind != -1:
                return m['content'][:ind + 3]
    return None


def get_instagram_image_url(post_url):
    try:
        img_url = None
        if post_url.find('instagram') != -1:
            try:
                soup = url_to_soup(post_url)
                img_url = get_instagram_page_image(soup)
            except:
                print "error"

        if img_url is not None:
            return img_url
        else:
            print "No Image Found"
            return None
    except:
        print "error"


def download_image(image_url):
    if image_url is None:
        return None
    image_path = "{}.jpg".format(uuid.uuid4())
    urllib.urlretrieve(image_url, image_path)
    return image_path


def validate_job(job):
    if 'image_urls' not in job.keys():
        return "No urls."
    return None


def process_message(key, job):
    caffe_root = os.getenv('CAFFE_HOME', '/home/caffe-user/caffe/')

    if not job:
        print 'No Valid Job.'
        return

    error = validate_job(job)
    if error is not None:
        print "Error in Job : {}".format(error)
        job['data'] = []
        job['error'] = error
        job['state'] = 'error'
        return

    image_path = None

    job_urls = json.loads(job['image_urls'])

    for url in job_urls['image_urls']:
        if url.find('instagram') == -1:
            continue

        image_url = get_instagram_image_url(url)
        if image_url is None:
            continue

        image_path = download_image(image_url)
        if image_path is not None:
            break

    if image_path is None:
        job['state'] = 'error'
        job['error'] = 'no valid images found to process'
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
    job['data'] = features
    job['state'] = 'processed'

    os.remove(image_path)
    # save features to redis


if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
                            channels=['genie:feature_img'])
    dispatcher.start()
