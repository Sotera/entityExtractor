import json, sys, os, urllib
from scipy.special import gdtr
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from loopy import Loopy

class EntityClusters:
    #prior_timeperiod_ms is the time, in miliseconds, to search for previous hashtag clusters of the same type.
    def __init__(self, min_posts, result_url, start_time_ms, prior_ms=604800000, likelihood_threshold=0.7):
        self.ent_groups = {}
        self.min_post = min_posts
        self.total_posts = 0
        self.url = result_url if result_url[-1] == "/" else result_url+"/"
        self.prior_ms = prior_ms
        self.start_ms = int(start_time_ms)
        self.l_thresh = likelihood_threshold

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
            "query_value":"entity"
        },
        {
            "query_type":"between",
            "property_name":"end_time_ms",
            "query_value":[q_start_time, self.start_ms]
        }]
        lp = Loopy(self.url, query_params)
        #Default parameters are slight to favor real data
        alpha = 0.00001
        beta = 1
        while True:
            page = lp.get_next_page()
            if page is None:
                break
            for doc in page:
                alpha += len(doc['similar_post_ids'])
                beta += doc['stats']['total_posts']
        return (alpha, beta)

    def process_vector(self, vector_id, post_id, text):
        self.total_posts += 1
        for term in vector:
            try:
                tl = term.lower()
                if tl in self.hash_groups.keys():
                    self.hash_groups[tl]['similar_ids'].append(vector_id)
                    self.hash_groups[tl]['similar_post_ids'].append(post_id)
                else:
                    alpha, beta = self.get_priors(tl)
                    self.hash_groups[tl] = {
                        'similar_ids': [vector_id],
                        'similar_post_ids': [post_id],
                        'stats':{
                            'prior_alpha': alpha,
                            'prior_beta': beta
                        }
                    }
            except:
                print "Error processing term:", term