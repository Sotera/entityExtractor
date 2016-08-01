import sys, os
from syntax_similarity import SyntaxVectorizer
sys.path.append(os.path.join(os.path.dirname(__file__), "./util"))
from redis_dispatcher import Dispatcher

def process_message(key, job):
    job['data'] = syntax_vectorizer.vec_from_tweet(job['txt'])
    job['state'] = 'processed'

if __name__ == '__main__':
    global syntax_vectorizer
    syntax_vectorizer = SyntaxVectorizer("july28_eng_")
    dispatcher = Dispatcher(redis_host='redis', process_func=process_message, channels=['featurize'])
    dispatcher.start()