from similarity_cluster import SimilarityCluster
import json
import numpy as np


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

    def process_vector(self, vector_id, post_id, vector):
            self.process_vector_custom(vector_id, post_id, vector)
            return

    @staticmethod
    def process_cluster_set(clusters, vector_id, post_id, vector, normalized_vector):
        for cluster in clusters.values():
            if cluster.process_similarity(vector_id, post_id, vector, normalized_vector):
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

    def process_vector_custom(self, vector_id, post_id, vector):
        normalized_vector = np.linalg.norm(vector)
        if normalized_vector == 0:
            print "normalized vector returned 0, skipping."
            return
        match_id = self.process_cluster_set(self.similarity_clusters["high"], vector_id, post_id, vector,
                                            normalized_vector)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["high"])
            return

        match_id = self.process_cluster_set(self.similarity_clusters["medium"], vector_id, post_id, vector,
                                            normalized_vector)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["medium"])
            return

        match_id = self.process_cluster_set(self.similarity_clusters["low"], vector_id, post_id, vector,
                                            normalized_vector)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["low"])
            return

        # found no matches, just add a new cluster to the low group
        new_cluster = SimilarityCluster(self.similarity_threshold, vector_id, post_id, vector,
                                        self.start_time_ms, self.end_time_ms)
        self.similarity_clusters["low"][new_cluster.id] = new_cluster

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

