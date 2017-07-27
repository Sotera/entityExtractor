#!/usr/bin/env python3

import sys, os
from fast_text_modeler import Model
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from redis_dispatcher import Dispatcher

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    # TODO: use lang?
    required = {'start_time_ms', 'end_time_ms'}
    if not required.issubset(job):
        set_err(job, 'Missing some required fields {}'.format(required))

def process_message(key, job):
    err_check(job)
    if job['state'] == 'error':
        return

    try:
        start_time = int(job['start_time_ms'])
        end_time = int(job['end_time_ms'])
        kafka_url = job['kafka_url'] if 'kafka_url' in job else 'print'
        kafka_topic = job['kafka_topic'] if 'kafka_topic' in job else 'print'

        model = Model()
        model.train(start_time, end_time)
        model.predict(start_time, end_time, kafka_url, kafka_topic)
    except Exception as e:
        set_err(job, str(e))
        return

    job['data'] = [] # output sent to kafka
    job['state'] = 'processed'
    return

if __name__ == '__main__':
    dispatcher = Dispatcher(redis_host='redis',
                            process_func=process_message,
                            queues=['genie:topic_model'])
    dispatcher.start()


    # model = Model()
    # model.train()
    # model.predict(kafka_topic='abc', kafka_url='print')
