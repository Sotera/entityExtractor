#!/usr/bin/env python3

import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher
from classifier import Classifier

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    required = {'event_ids'}
    if not required.issubset(job):
        set_err(job, 'Missing some required fields {}'.format(required))

def process_message(key, job):
    err_check(job)
    if job['state'] == 'error':
        return

    # more stable if new instance for each job.
    # TODO: singleton instead
    clf = Classifier()

    clf.run(job['event_ids'])

    # nothing to save
    job['data'] = []
    job['state'] = 'processed'

dispatcher = Dispatcher(redis_host='redis',
                        process_func=process_message,
                        queues=['genie:event_classifier'])
dispatcher.start()
