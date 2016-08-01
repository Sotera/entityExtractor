import json, re
from gensim.models import Word2Vec
import numpy as np

class SyntaxVectorizer:
    def __init__(self, str_model_stem):
        self.d_idf = json.load(open('./models/' + str_model_stem + "tfidf"))
        self.model_w2v = Word2Vec.load('./models/' + str_model_stem + "word2vec")
        self.set_w2v_words = set(self.model_w2v.index2word)
        self.dim = self.model_w2v[self.model_w2v.vocab.keys()[0]]

    def vec_from_tweet(self, txt):
        txt = re.sub('[\s#]', ' ', txt.lower())
        txt = re.sub('[^\w\s]', '', txt)
        l_txt = filter(lambda x: x!='', txt.split(' '))
        v = np.zeros(len(self.dim))
        for term in l_txt:
            if term in self.set_w2v_words and term in self.d_idf.keys():
                v = v + self.d_idf[term]*self.model_w2v[term]
        return v