from similarity_cluster import SimilarityCluster
import json
import numpy as np

ZERO_EPSILON = 0.000000001

class FeatureSimilarity:
    def __init__(self, similarity_threshold, start_time_ms, end_time_ms):
        self.similarity_threshold = similarity_threshold
        self.high = 10
        self.medium = 4
        self.low = 2
        self.similarity_clusters = {
            "high": {},
            "medium": {},
            "low": {}
        }
        self.start_time_ms = start_time_ms
        self.end_time_ms = end_time_ms

    def process_vector(self, vector_id, post_id, vector, image_url=None):
            self.process_vector_custom(vector_id, post_id, vector, image_url)
            return

    @staticmethod
    def process_cluster_set(clusters, vector_id, post_id, vector, vector_magnitude, image_url=None):
        for cluster in clusters.values():
            if cluster.process_similarity(vector_id, post_id, vector, vector_magnitude, image_url):
                return cluster.id
        return None

    def organize_cluster(self, cluster_id, cluster_set):
        cluster = cluster_set[cluster_id]
        cluster_length = len(cluster.similar_ids)
        if cluster_length == self.high:
            self.similarity_clusters["high"][cluster_id] = cluster
            del self.similarity_clusters["medium"][cluster_id]
            return
        if cluster_length == self.medium:
            self.similarity_clusters["medium"][cluster_id] = cluster
            del self.similarity_clusters["low"][cluster_id]
            return

    def create_cluster(self, vector_id, post_id, vector, image_url):
        return SimilarityCluster(self.similarity_threshold, vector_id, post_id, vector,
                                        self.start_time_ms, self.end_time_ms, image_url)
    
    def process_vector_custom(self, vector_id, post_id, vector, image_url=None):
        vector_magnitude = np.linalg.norm(vector)
        if vector_magnitude < ZERO_EPSILON:
            print "normalized vector returned 0, skipping."
            return
        match_id = self.process_cluster_set(self.similarity_clusters["high"], vector_id, post_id, vector,
                                            vector_magnitude, image_url)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["high"])
            return

        match_id = self.process_cluster_set(self.similarity_clusters["medium"], vector_id, post_id, vector,
                                            vector_magnitude, image_url)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["medium"])
            return

        match_id = self.process_cluster_set(self.similarity_clusters["low"], vector_id, post_id, vector,
                                            vector_magnitude, image_url)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["low"])
            return

        # found no matches, just add a new cluster to the low group
        new_cluster = self.create_cluster(vector_id, post_id, vector, image_url)
        self.similarity_clusters["low"][new_cluster.id] = new_cluster

    def get_clusters_to_delete(self):
        return self.similarity_clusters["low"].values()

    def get_clusters(self):
            return self.get_clusters_custom()

    def get_clusters_custom(self):
        serializable_list = []

        for cluster in self.similarity_clusters["high"].values():
            serializable_list.append(cluster.to_serializable_object())
        for cluster in self.similarity_clusters["medium"].values():
            serializable_list.append(cluster.to_serializable_object())

        return serializable_list

    def to_json(self):
        return json.dumps(self.get_clusters())

#
#  Override vector aggregation and comparisons for data_type="image"
#
class ImageFeatureSimilarity(FeatureSimilarity):
    def __init__(self, similarity_threshold, start_time_ms, end_time_ms):
        super(FeatureSimilarity, self).__init__(self, similarity_threshold, start_time_ms, end_time_ms)
        
    def create_cluster(self, vector_id, post_id, vector, image_url):
        return ImageSimilarityCluster(self.similarity_threshold, vector_id, post_id, vector,
                                        self.start_time_ms, self.end_time_ms, image_url)

