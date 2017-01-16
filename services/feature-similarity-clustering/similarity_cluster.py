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
        self.average_similarity_vector = initial_vector
        self.normalized_average_similarity_vector = np.linalg.norm(initial_vector)
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

    def process_similarity(self, vector_id, post_id, vector, vector_normalized, image_url=None):
        similarity = self.cosine_similarity(self.average_similarity_vector, self.normalized_average_similarity_vector,
                                            vector, vector_normalized)
        are_similar = similarity > self.similarity_threshold

        if are_similar:
            self.apply_vector_to_average(vector)
            self.similar_ids.append(vector_id)
            self.similar_post_ids.append(post_id)
            self.running_stat.push(similarity)
            if image_url is not None:
                self.similar_image_urls.append(image_url)

        return are_similar

    def apply_vector_to_average(self, vector):
        self.average_similarity_vector = [n / (len(self.similar_ids)+1)
                                          for n in [(x * len(self.similar_ids)) + y for x, y in
                                          izip(self.average_similarity_vector, vector)]]
        self.normalized_average_similarity_vector = np.linalg.norm(self.average_similarity_vector)

    def to_serializable_object(self):
        serializable_obj = {
            "variance": self.running_stat.variance(),
            "average_similarity_vector": self.average_similarity_vector,
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
