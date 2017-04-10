import json, sys, os , urllib
import numpy as np
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from loopy import Loopy
from sentiment_filters import SentimentFilter

class MutualInformation:
    def __init__(self, min_posts, results_url, start_time_ms, prior_ms=604800000):
        self.word_pairs = {}
        self.word_counts = {}
        self.min_post = min_posts
        self.post_per_lang = {}
        self.url = results_url if results_url[-1] == "/" else results_url + "/"
        self.prior_ms = prior_ms
        self.start_ms = int(start_time_ms)
        self.sf = SentimentFilter()

    def get_priors(self, term):
        q_start_time = self.start_ms - self.prior_ms
        term = unicode(term)
        query_params = [{
            "query_type":"where",
            "property_name":"term",
            "query_value": urllib.quote(term.encode('utf-8'), ':/')
        },
        {
            "query_type":"where",
            "property_name":"data_type",
            "query_value":"text"
        },
        {
            "query_type":"between",
            "property_name":"end_time_ms",
            "query_value":[q_start_time, self.start_ms]
        }]
        lp = Loopy(self.url, query_params)

        points = []
        while True:
            page = lp.get_next_page()
            if page is None:
                break
            for doc in page:
                points.append(len(doc['similar_post_ids']))
        if len(points)==0:
            return (-3.0, 0.5)
        if len(points)<3:
            return (np.mean(points), 0.5)
        return (np.mean(points), np.std(points))

    def create_word_pairs(self, words, s_join = "_+_"):
        pairs = []
        for i in range(len(words)):
            for ii in range(i+1, len(words)):
                pairs.append(s_join.join(sorted([words[i], words[ii]])))
        return pairs

    def process_vector(self, vector_id, post_id, text, lang):
        if lang in self.post_per_lang:
            self.post_per_lang[lang] += 1
        else:
            self.post_per_lang[lang] = 1

        words = self.sf.tokenize(text, lang)
        for word in words:
            if word in self.word_counts:
                self.word_counts[word] += 1
            else:
                self.word_counts[word] = 1

        for term in self.create_word_pairs(words):
            try:
                if term in self.word_pairs.keys():
                    self.word_pairs[term]['similar_ids'].append(vector_id)
                    self.word_pairs[term]['similar_post_ids'].append(post_id)
                else:
                    mu, sigma = self.get_priors(term)
                    self.word_pairs[term] = {
                        'similar_ids': [vector_id],
                        'similar_post_ids': [post_id],
                        'lang': lang,
                        'stats':{
                            'prior_mu': mu,
                            'prior_sigma': sigma
                        }
                    }
            except:
                print "Error processing term:", term

    def get_deletable_ids(self):
        candidate_ids = []
        deletable_ids = []
        valid_clusters = self.get_clusters()
        for k, vSim in self.word_pairs.iteritems():
            if len(vSim['similar_post_ids']) < self.min_post:
                candidate_ids.extend(vSim['similar_post_ids'])
                deletable_ids.extend(vSim['similar_post_ids'])
        for post_id in candidate_ids:
            for cluster_key, cluster in valid_clusters.iteritems():
                if post_id in cluster['similar_post_ids']:
                    if post_id in deletable_ids:
                        deletable_ids.remove(post_id)
                    continue
        return deletable_ids

    def pmi(self, term, lang):
        words = term.split("_+_")
        n_lang = self.post_per_lang[lang]
        n1 = self.word_counts[words[0]]
        n2 = self.word_counts[words[1]]
        n12 = len(self.word_pairs[term]['similar_post_ids'])
        return np.log2(float(n12*n_lang)/(n1*n2))

    def get_clusters(self):
        d0 = {}
        for k, vSim in self.word_pairs.iteritems():
            n_terms = len(vSim['similar_post_ids'])
            if n_terms >= self.min_post:
                vSim['stats']['total_posts'] = self.post_per_lang[vSim['lang']]
                vSim['stats']['pmi'] = self.pmi(k, vSim['lang'])
                vSim['stats']['is_unlikely'] = 1 if vSim['stats']['pmi'] > (vSim['stats']['prior_mu'] + 2*vSim['stats']['prior_sigma']) else 0
                d0[k] = vSim
        return d0

    def to_json(self):
        return json.dumps(self.get_clusters())