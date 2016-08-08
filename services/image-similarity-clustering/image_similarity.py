from similarity_cluster import SimilarityCluster
import json
import falconn
import numpy as np


class ImageSimilarity:
    def __init__(self, similarity_threshold, start_time_ms, end_time_ms, similarity_method="custom"):
        self.similarity_threshold = similarity_threshold
        self.high = 10
        self.medium = 4
        self.low = 2
        self.similarity_clusters = {
            "high": {},
            "medium": {},
            "low": {}
        }
        self.similarity_method = similarity_method
        self.vector_matrix = []
        self.vector_id_list = []
        self.start_time_ms = start_time_ms
        self.end_time_ms = end_time_ms

    def process_vector(self, vector_id, vector):
        if self.similarity_method == "custom":
            self.process_vector_custom(vector_id, vector)
            return
        if self.similarity_method == "falconn":
            self.process_vector_falconn(vector_id, vector)
            return

    def process_vector_falconn(self, vector_id, vector):
        self.vector_matrix.append(vector)
        self.vector_id_list.append(vector_id)

    @staticmethod
    def process_cluster_set(clusters, vector_id, vector, normalized_vector):
        for cluster in clusters.values():
            if cluster.process_similarity(vector_id, vector, normalized_vector):
                return cluster.id
        return None

    def organize_cluster(self, cluster_id, cluster_set):
        cluster = cluster_set[cluster_id]
        cluster_length = len(cluster.similar_image_ids)
        if cluster_length == self.high:
            self.similarity_clusters["high"][cluster_id] = cluster
            del self.similarity_clusters["medium"][cluster_id]
            return
        if cluster_length == self.medium:
            self.similarity_clusters["medium"][cluster_id] = cluster
            del self.similarity_clusters["low"][cluster_id]
            return

    def process_vector_custom(self, vector_id, vector):
        normalized_vector = np.linalg.norm(vector)
        if normalized_vector == 0:
            print "normalized vector returned 0, skipping."
            return
        match_id = self.process_cluster_set(self.similarity_clusters["high"], vector_id, vector, normalized_vector)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["high"])
            return

        match_id = self.process_cluster_set(self.similarity_clusters["medium"], vector_id, vector, normalized_vector)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["medium"])
            return

        match_id = self.process_cluster_set(self.similarity_clusters["low"], vector_id, vector, normalized_vector)
        if match_id is not None:
            self.organize_cluster(match_id, self.similarity_clusters["low"])
            return

        # found no matches, just add a new cluster to the low group
        new_cluster = SimilarityCluster(self.similarity_threshold, vector_id, vector,
                                        self.start_time_ms, self.end_time_ms)
        self.similarity_clusters["low"][new_cluster.id] = new_cluster

    def get_clusters(self):
        if self.similarity_method == "custom":
            return self.get_clusters_custom()
        if self.similarity_method == "falconn":
            return self.get_clusters_falconn()

    def get_clusters_falconn(self):
        serializable_list = []
        vector_numpy_ndarray = np.array(self.vector_matrix)
        vector_numpy_ndarray /= np.linalg.norm(vector_numpy_ndarray).reshape(-1, 1)
        center = np.mean(vector_numpy_ndarray)
        vector_numpy_ndarray -= center
        falconn_params = falconn.get_default_parameters(len(self.vector_matrix), len(self.vector_matrix[0]))
        falconn_params.distance_function = "euclidean_squared"
        lsh_index = falconn.LSHIndex(falconn_params)
        lsh_index.setup(vector_numpy_ndarray)
        i = 0
        for vector in self.vector_matrix:
            cluster = lsh_index.find_near_neighbors(np.array(vector), self.similarity_threshold)
            cluster = cluster + (i,)
            i += 1
            if len(cluster) < 2:
                continue
            similarity_cluster = SimilarityCluster(self.similarity_threshold,
                                                   self.vector_id_list[cluster[0]],
                                                   self.vector_matrix[cluster[0]],
                                                   self.start_time_ms,
                                                   self.end_time_ms)
            for index in cluster:
                if index == cluster[0]:
                    continue
                similarity_cluster.similar_image_ids.append(self.vector_id_list[index])
                similarity_cluster.apply_vector_to_average(self.vector_matrix[index])
            serializable_list.append(similarity_cluster.to_serializable_object())
        return serializable_list

    def get_clusters_custom(self):
        serializable_list = []

        for cluster in self.similarity_clusters["high"].values():
            serializable_list.append(cluster.to_serializable_object())
        for cluster in self.similarity_clusters["medium"].values():
            serializable_list.append(cluster.to_serializable_object())

        return serializable_list

    def to_json(self):
        return json.dumps(self.get_clusters())



if __name__ == "__main__":
    # get data
    data = [
        [
            2.0112218856811523,
            0,
            0.4733978509902954,
            2.1764729022979736,
            0
        ],
        [
            2.0156811523,
            1.00000005,
            0.48509902954,
            1.1764729797361,
            1
        ],
        [
            13.0,
            23.0,
            43.0,
            63.0,
            3.0
        ],
        [
            2.0112218856811523,
            0,
            0.473397850990295,
            2.176472922979736,
            0
        ]
    ]
    imageSim = ImageSimilarity(.8)
    imageSim.process_vector(0, data[0])
    imageSim.process_vector(1, data[1])
    imageSim.process_vector(2, data[2])
    imageSim.process_vector(3, data[3])

    print "done"
