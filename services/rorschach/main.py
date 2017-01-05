import sys, os, argparse
from syntax_similarity import SyntaxVectorizer
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from redis_dispatcher import Dispatcher
from sentiment_filters import SentimentFilter

def set_err(job, msg):
    job['state'] = 'error'
    job['data'] = []
    job['error'] = msg


def process_message(key, job):
    # Examine job for correct fields
    if 'txt' not in job.keys():
        set_err(job, "No 'txt' in job fields")
        return
    if 'lang' not in job.keys():
        set_err(job, "No 'lang' in job fields")
        return

    # Check if the text language can be featurized
    lng = job['lang']
    if lng in model_langs:
        try:
            if sent_filt.is_scoreable(job['txt'], lng) is False:
                job['data'] = []
                job['state'] = 'processed'
                return
        except:
            set_err(job, "Error checking if doc is 'scorable', language=" + str(lng))
            return

        try:
            job['data'] = syntax_vectorizer[lng].vec_from_tweet(sent_filt.tokenize(job['txt'], lng))
            job['state'] = 'processed'
            return
        except:
            set_err(job, "Error making syntax vector (" + lng + "):\n" + str(sys.exc_info()[0]))
            return
    else:
        job['data'] = []
        job['state'] = 'processed'
        return

if __name__ == '__main__':
    ar = argparse.ArgumentParser()
    ar.add_argument("-modelPath", help="Path to model (e.g. ./models)")
    ar.add_argument("-englishModel", help="Name of Engilsh model")
    ar.add_argument("-arabicModel", help="Name of Arabic model")
    args = ar.parse_args()
    print "Parsed args"
    global model_langs
    model_langs = ['en', 'ar']
    print "Making filter"
    global sent_filt
    sent_filt = SentimentFilter()
    global syntax_vectorizer
    syntax_vectorizer = {}

    if args.englishModel != '':
        syntax_vectorizer['en'] = SyntaxVectorizer(args.modelPath, args.englishModel)
    if args.arabicModel != '':
        syntax_vectorizer['ar'] = SyntaxVectorizer(args.modelPath, args.arabicModel)
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message,
        queues=['genie:feature_txt'])
    dispatcher.start()
