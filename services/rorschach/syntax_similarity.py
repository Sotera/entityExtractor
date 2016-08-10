import json, re

class SyntaxVectorizer:
    def __init__(self, str_model_stem):
        #self.d_idf = json.load(open('./models/' + str_model_stem + "tfidf"))
        #self.model_w2v = Word2Vec.load('./models/' + str_model_stem + "word2vec")
        self.model = json.load(open('./models/' + str_model_stem))
        self.model_words = set(self.model.keys())
        self.dim = len(self.model[self.model.keys()[0]])

    def vec_from_tweet(self, l_txt):
        v = self.dim*[0]
        for term in l_txt:
            if term in self.model_words:
                #v = v + self.d_idf[term]*self.model_w2v[term]
                v = v + self.model[term]
        return v

