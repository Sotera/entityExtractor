from running_stat import RunningStat
import numpy as np
from itertools import starmap,izip
from operator import mul
import uuid
import requests


class SimilarityCluster:
    def __init__(self, similarity_threshold, initial_vector_id, initial_post_id, initial_vector, start_time_ms,
                 end_time_ms, initial_image_url=None):
        self.valid_cluster = True
        if initial_vector is None or len(initial_vector) == 0:
            self.valid_cluster = False
        self.cluster_vector = initial_vector
        self.cluster_vector_magnitude = np.linalg.norm(initial_vector)
        self.similar_ids = [initial_vector_id]
        self.similar_post_ids = [initial_post_id]
        if initial_image_url is not None:
            self.similar_image_urls = [initial_image_url]
        else:
            self.similar_image_urls = None
        self.similarity_threshold = similarity_threshold
        self.running_stat = RunningStat()
        self.id = uuid.uuid4()
        self.start_time_ms = start_time_ms
        self.end_time_ms = end_time_ms

    def compute_similarity(self, vector, vector_magnitude):
        r = self.cosine_similarity(self.average_similarity_vector, self.normalized_average_similarity_vector,
                                            vector, vector_magnitude)
        return r
        
    def process_similarity(self, vector_id, post_id, vector, vector_magnitude, image_url=None):
        similarity = self.compute_similarity(vector, vector_magnitude)
        are_similar = similarity > self.similarity_threshold

        if are_similar:
            self.apply_vector_to_cluster(vector)
            self.similar_ids.append(vector_id)
            self.similar_post_ids.append(post_id)
            self.running_stat.push(similarity)
            if image_url is not None:
                self.similar_image_urls.append(image_url)

        return are_similar

    def apply_vector_to_cluster(self, vector):
        self.cluster_vector = [n / (len(self.similar_ids)+1)
                                          for n in [(x * len(self.similar_ids)) + y for x, y in
                                          izip(self.cluster_vector, vector)]]
        self.cluster_vector_magnitude = np.linalg.norm(self.cluster_vector)

    def to_serializable_object(self):
        serializable_obj = {
            "variance": self.running_stat.variance(),
            "average_similarity_vector": self.cluster_vector,
            "average_similarity": self.running_stat.mean(),
            "similar_ids": self.similar_ids,
            "similar_post_ids": self.similar_post_ids,
            "start_time_ms": self.start_time_ms,
            "end_time_ms": self.end_time_ms,
            "id": str(self.id)
        }
        if self.similar_image_urls is not None:
            serializable_obj['similar_image_urls'] = self.similar_image_urls
        return serializable_obj

    @staticmethod
    def cosine_similarity(v1, normalized_v1, v2, normalized_v2):
        return sum(starmap(mul, izip(v1, v2))) / (normalized_v1 * normalized_v2)

# Override aggregation and comparison for Image Clusters
class ImageSimilarityCluster(SimilarityCluster):
    def __init__(self, similarity_threshold, initial_vector_id, initial_post_id, initial_vector, start_time_ms,
                 end_time_ms, initial_image_url=None):
        super(SimilarityCluster, self).__init__(self, similarity_threshold, initial_vector_id, initial_post_id, initial_vector, start_time_ms,
                 end_time_ms, initial_image_url)
        # Set this to an innoculous value just in case something relies on this
        self.cluster_vector_magnitude = 1.0
                 
    def compute_similarity(self, vector, vector_magnitude):
        # vector_magnitude is not used here, but base-class function has this parameter so we have it
        # dot the "prob" BLVC network output vector with the unnormalized max-vector of the cluster
        r = numpy.dot(self.cluster_vector, vector)
        if r > 1.0:
            r = 1.0
        return r

    def apply_vector_to_cluster(self, vector):
        self.cluster_vector = [ max(self[i], vector[i]) for i in len(self) ]
        # Set this to an innoculous value just in case something relies on this
        self.cluster_vector_magnitude = 1.0
        