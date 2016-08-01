import json, time, re, os, logging, sys, multiprocessing, random

from collections import namedtuple
import numpy as np
import matplotlib.pyplot as plt

from gensim.models import Doc2Vec
import gensim.models.doc2vec
sys.path.append('./lib')
from sentiment_filters import is_scoreable

def vec_from_sd(model, sd):
    return model.infer_vector(' '.join(sd.words))

def get_cos(v1, v2):
    return np.dot(v1, v2)/(np.linalg.norm(v1)*np.linalg.norm(v2))

def main():
    s_path = '/Volumes/ed_00/data/raw_tweet_data/tweets_w_img_url/'
    l_files = os.listdir(s_path)
    _X = []
    SentimentDocument = namedtuple('SentimentDocument', 'words tags split sentiment')
    train_test_bit = 0
    p_docs = []
    p_soc = []
    for l_num, s_file in enumerate(l_files):
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
            tags = [l_num]
            train_test_bit = (train_test_bit + 1) % 3
            split = ['train', 'test', 'train'][train_test_bit]
            if 'blm' in l_txt:
                p_docs.append(len(_X))
            if 'football' in l_txt:
                p_soc.append(len(_X))
            sentiment = None
            _X.append(SentimentDocument(l_txt, tags, split, sentiment))

    print "Training Model"
    t0 = time.time()
    logging.basicConfig(format='%(asctime)s : %(levelname)s : %(message)s', level=logging.INFO)
    cores = multiprocessing.cpu_count()
    assert gensim.models.doc2vec.FAST_VERSION > -1
    model = Doc2Vec(documents=_X, size=1000, min_count=25, workers=cores)
    diff = time.time()-t0
    print "Time to train model:", diff
    print "Number of tweets:", len(_X)

    print "\n\nTest closeness->"
    print "TEST 1: Random Sample"
    doc_id = np.random.randint(model.docvecs.count)
    sims = model.docvecs.most_similar(doc_id, topn=model.docvecs.count)
    print "Targe (%d): %s\n'" %(doc_id, ' '.join(_X[doc_id].words))
    for label, index in [('MOST', 0), ('MEDIAN', len(sims)//2), ('LEAST', len(sims) -1)]:
        print "%s %s: %s\n" %(label, sims[index], ' '.join(_X[sims[index][0]].words))

    print "TEST 2: 'blm' vecs"
    #checked = 0
    #similar = 0
    l_blm_cos = []
    l_soc_cos = []
    for i in range(len(p_docs)):
        v1 = vec_from_sd(model, _X[p_docs[i]])
        for j in range(i+1,len(p_docs)):
            #checked += 1
            v2 = vec_from_sd(model, _X[p_docs[j]])
            cos = get_cos(v1, v2)
            l_blm_cos.append(cos)
            #thresh = 0.95
            #if cos > thresh:
                #similar += 1
                #print "\n***\nSimilar vectors, cosine =", cos
                #print "Sentance 1\n\t", ' '.join(_X[p_docs[i]].words)
                #print "Sentance 2\n\t", ' '.join(_X[p_docs[j]].words),"\n"
        for k in range(len(p_soc)):
            v3 = vec_from_sd(model, _X[p_soc[k]])
            cos = get_cos(v1, v3)
            l_soc_cos.append(cos)

    #print "Of a possible", checked, "pairs,", similar, "had beyond the", thresh, "cosine similarity threshold"
    bins = map(lambda x: x*0.05, range(21))
    plt.figure(1)
    plt.subplot(211)
    plt.hist(l_blm_cos, bins=bins)
    plt.title("Cos Similarity blm-blm")
    plt.subplot(212)
    plt.hist(l_soc_cos, bins=bins)
    plt.title("Cos Similarity blm-soccer")
    plt.show()

if __name__ == "__main__":
    main()