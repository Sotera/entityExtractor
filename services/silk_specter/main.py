import sys, os, argparse
from topic_modeler import TopicModeler
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from sentiment_filters import SentimentFilter

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

    # Check if the text language can be featurized
    lng = job['lang']
    if lng in topic_modeler.langs():
        try:
            job['data'] = topic_modeler.assign_topics(lng, job['txt'])
            job['state'] = 'processed'
            return
        except:
            set_err(job, "Error making topic vector (" + lng + "):\n" + str(sys.exc_info()[0]))
            return
    else:
        job['data'] = []
        job['state'] = 'processed'
        return

if __name__ == '__main__':
    ar = argparse.ArgumentParser()
    ar.add_argument("-modelPath", help="Path to model (e.g. ./models)")
    ar.add_argument("-englishModel", help="Name of Engilsh model")
    args = ar.parse_args()
    print "Making filter"
    global topic_modeler
    topic_modeler = TopicModeler()

    if args.englishModel != '':
        topic_modeler.load_lang('en', args.modelPath, args.englishModel)
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
        queues=['genie:topic_txt'])
    dispatcher.start()
