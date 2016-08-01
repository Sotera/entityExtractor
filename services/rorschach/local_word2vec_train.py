import json, time, re, os, logging, sys
from gensim.models import Word2Vec
sys.path.append('./lib')
from sentiment_filters import is_scoreable

def main():
    s_path = '/Volumes/ed_00/data/raw_tweet_data/tweets_w_img_url/'
    l_files = os.listdir(s_path)
    #l_files = l_files[:5]
    _X = []
    for s_file in l_files:
        if s_file[-4:] != 'json':
            continue
        print "Processing File:", s_file
        f = open(s_path+s_file)
        for line in f:
            d0 = json.loads(line)
            if d0['lang'] != 'en':
                continue
            txt = d0['text']
            if is_scoreable(txt) == False:
                continue
            txt = re.sub('[\s#]', ' ', txt.lower())
            txt = re.sub('[^\w\s]', '', txt)
            l_txt = txt.split(' ')
            l_txt = filter(lambda x: x!='', l_txt)
            _X.append(l_txt)

    print "Training Model"
    t0 = time.time()
    logging.basicConfig(format='%(asctime)s : %(levelname)s : %(message)s', level=logging.INFO)
    model = Word2Vec(_X, min_count = 100, size = 200)
    diff = time.time()-t0
    print "Time to train model:", diff
    print "Number of tweets:", len(_X)
    print "Most similar to 'protest':"
    print model.most_similar(positive=['protest'], topn=3)
    model.save("./models/small_gensim_word2vec")

if __name__ == "__main__":
    main()