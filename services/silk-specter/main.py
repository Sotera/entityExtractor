#!/usr/bin/env python3

import sys, os, argparse
# from topic_modeler import TopicModeler
from fast_text_train import Trainer
from fast_text_run import Runner
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher

# train only on first call.
# trainer = None

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg

def err_check(job):
    required = {'start_time_ms', 'end_time_ms', 'lang'}
    if not required.issubset(job):
        set_err(job, 'Missing some required fields {}'.format(required))

def process_message(key, job):
    err_check(job)
    if job['state'] == 'error':
        return

    start_time = int(job['start_time_ms'])
    end_time = int(job['end_time_ms'])

    # if not trainer:
    trainer = Trainer()
    trainer.train(start_time, end_time)

    clf = trainer.classifier

    runner = Runner()
    runner.run(clf, start_time, end_time)

    # TODO
    # Check if the text language can be featurized
    # lng = job['lang']
    # if lng in topic_modeler.langs():
    #     try:
    #         job['data'] = topic_modeler.assign_topics(lng, job['txt'])
    #         job['state'] = 'processed'
    #         return
    #     except:
    #         set_err(job, "Error making topic vector (" + lng + "):\n" + str(sys.exc_info()[0]))
    #         return
    # else:
    #     job['data'] = []
    #     job['state'] = 'processed'
    #     return

if __name__ == '__main__':
    ar = argparse.ArgumentParser()
    # ar.add_argument("-modelPath", help="Path to model (e.g. ./models)")
    # ar.add_argument("-englishModel", help="Name of English model")
    # args = ar.parse_args()
    # print "Making filter"
    # global topic_modeler
    # topic_modeler = TopicModeler()

    # if args.englishModel != '':
    #     topic_modeler.load_lang('en', args.modelPath, args.englishModel)
    # dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
    #     queues=['genie:topic_txt'])
    # dispatcher.start()
    trainer = Trainer()
    trainer.train()

    clf = trainer.classifier

    runner = Runner()
    runner.run(clf)
