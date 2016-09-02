class ClusterLinker:
    def __init__(self, min_overlap):
        self.l_clusts = []
        self.l_clust_links = []
        self.thresh = float(min_overlap)

    def compare_clusters(self, c1, c2):
        if len(c1['similar_ids'])==0 or len(c2['similar_ids'])==0:
            return
        if len(c1['similar_ids']) < len(c2['similar_ids']):
            small = c1
            big = set(c2['similar_ids'])
            big_id = c2['id']
        else:
            small = c2
            big = set(c1['similar_ids'])
            big_id = c1['id']
        l_common = []
        for id in small['similar_ids']:
            if id in big:
                l_common.append(id)
        ratio = (1.*len(l_common))/(1.*len(small['similar_ids']))
        if ratio > self.thresh:
            d_clust = {
                'source': small['id'],
                'target': big_id,
                'weight': ratio,
                'common_ids': l_common,
                'end_time_ms': c1['end_time_ms']
            }
            self.l_clust_links.append(d_clust)


    def get_links(self):
        return self.l_clust_links

    def add_cluster(self, clust_new):
        for c in self.l_clusts:
            self.compare_clusters(c, clust_new)
        self.l_clusts.append(clust_new)
