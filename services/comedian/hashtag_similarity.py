import json

class HashtagClusters:
    def __init__(self, min_posts):
        self.hash_groups = {}
        self.min_post = min_posts

    def process_vector(self, vector_id, post_id, vector):
        for term in vector:
            tl = term.lower()
            if tl in self.hash_groups.keys():
                self.hash_groups[tl]['similar_ids'].append(vector_id)
                self.hash_groups[tl]['similar_post_ids'].append(post_id)
            else:
                self.hash_groups[tl] = {'similar_ids': [vector_id], 'similar_post_ids': [post_id]}

    def get_clusters(self):
        d0 = {}
        for k, vSim in self.hash_groups.iteritems():
            if len(vSim['similar_post_ids']) > self.min_post:
                d0[k] = vSim
        return d0

    def to_json(self):
        return json.dumps(self.get_clusters())

