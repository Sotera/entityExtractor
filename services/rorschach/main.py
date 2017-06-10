import argparse
import os
import sys
import json

sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from sentiment_filters import SentimentFilter

sentiment = None

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg


def process_message(key, job):
    # Examine job for correct fields
    if 'txt' not in job:
        set_err(job, "No 'txt' in job fields")
        return
    if 'lang' not in job:
        set_err(job, "No 'lang' in job fields")
        return

    try:
        job['data'] = json.dumps(sentiment.ents(job['txt'], job['lang']))
        print job['data']
        job['state'] = 'processed'
    except:
        set_err(job, "Error finding entities")
        return

if __name__ == '__main__':
    global sentiment
    ar = argparse.ArgumentParser()
    ar.add_argument("-modelPath", help="Path to model (e.g. ./models)")
    args = ar.parse_args()
    sentiment = SentimentFilter()
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message, queues=['genie:feature_txt'])
    dispatcher.start()
