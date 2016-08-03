from running_stat import RunningStat
import numpy as np
from itertools import starmap,izip
from operator import mul
import uuid


class SimilarityCluster:
    def __init__(self, similarity_threshold, initial_vector_id, initial_vector, start_time_ms, end_time_ms):
        self.average_similarity_vector = initial_vector
        self.normalized_average_similarity_vector = np.linalg.norm(initial_vector)
        self.similar_image_ids = [initial_vector_id]
        self.similarity_threshold = similarity_threshold
        self.running_stat = RunningStat()
        self.id = uuid.uuid4()
        self.start_time_ms = start_time_ms
        self.end_time_ms = end_time_ms

    def process_similarity(self, vector_id, vector, vector_normalized):
        similarity = self.cosine_similarity(self.average_similarity_vector, self.normalized_average_similarity_vector,
                                            vector, vector_normalized)
        are_similar = similarity > self.similarity_threshold

        if are_similar:
            # print "{} is similar to {}".format(vector_id, self.similar_image_ids[0])
            self.apply_vector_to_average(vector)
            self.similar_image_ids.append(vector_id)
            self.running_stat.push(similarity)

        return are_similar

    def apply_vector_to_average(self, vector):
        self.average_similarity_vector = [n / (len(self.similar_image_ids)+1)
                                          for n in [(x * len(self.similar_image_ids)) + y for x, y in
                                          izip(self.average_similarity_vector, vector)]]
        self.normalized_average_similarity_vector = np.linalg.norm(self.average_similarity_vector)

    def to_serializable_object(self):
        return {
            "variance": self.running_stat.variance(),
            "average_similarity_vector": self.average_similarity_vector,
            "average_similarity": self.running_stat.mean(),
            "similar_image_ids": self.similar_image_ids,
            "start_time_ms": self.start_time_ms,
            "end_time_ms": self.end_time_ms,
            "id": str(self.id)
        }

    @staticmethod
    def cosine_similarity(v1, normalized_v1, v2, normalized_v2):
        return sum(starmap(mul, izip(v1, v2))) / (normalized_v1 * normalized_v2)
