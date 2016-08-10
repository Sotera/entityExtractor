import json, re

class SyntaxVectorizer:
    def __init__(self, str_model_path, str_model_stem):
        if str_model_path[-1] != "/":
            str_model_path = str_model_path + "/"
        self.model = json.load(open(str_model_path + str_model_stem))
        self.model_words = set(self.model.keys())
        self.dim = len(self.model[self.model.keys()[0]])

    def vec_from_tweet(self, l_txt):
        v = self.dim*[0]
        for term in l_txt:
            if term in self.model_words:
                v = v + self.model[term]
        return v

