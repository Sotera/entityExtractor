import sys, os
from geo_handler import GeoHandler
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from loopy import Loopy

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    print "Checking job parameters"
    if job.get('type') == 'featurizer':
        if 'geo' not in job.keys():
            set_err(job, "No 'geo' in job fields")
        if 'location' not in job.keys():
            set_err(job, "No 'location (user subfield)'")
        if 'place' not in job.keys():
            set_err(job, "No 'coordinates'")
    if job.get('type') == 'event_geo':
        if 'start_time_ms' not in job.keys():
            set_err(job, "No 'start_time_ms' in job fields")
        if 'end_time_ms' not in job.keys():
            set_err(job, "No 'end_time_ms' in job fields")
        if 'result_url' not in job.keys():
            set_err(job, "No 'result_url' in job fields")
        if 'job_id' not in job.keys():
            set_err(job, "No 'job_id' in job fields")
        if 'query_url' not in job.keys():
            set_err(job, "No 'query_url' in job fields")

def process_message(key, job):
    err_check(job)
    if job['state'] == 'error':
        return

    if job.get('type') == 'featurizer':
        d0 = {'geo':job.get('geo'), 'location':job.get('location'), 'place':job.get('place')}
        job['state'] = 'processed'
        job['data'] = g_h.get_tweet_geo_features(d0)
        return

    print 'FINDING SIMILARITY'




if __name__ == '__main__':
    global g_h
    g_h = GeoHandler()
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            channels=['genie:feature_geo', 'genie:event_geo'])
    dispatcher.start()