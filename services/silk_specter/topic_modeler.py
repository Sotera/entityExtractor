from gensim.models.ldamodel import LdaModel
import sys
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from sentiment_filters import SentimentFilter

class TopicModeler:
    def __init__(self):
        self.models = {}
        self.sf = SentimentFilter()

    def langs(self):
        return self.models.keys()

    def load_lang(self, lang, model_path, model_name):
        if model_path[-1] != "/":
            medel_path = model_path + "/"
        self.models[lang] = LdaModel.load(model_path + model_name)

    def assign_topics(self, lang, text):
        tokens = self.sf(text, lang)
        return self.models[lang][self.models[lang].id2word.doc2bow(tokens)]
