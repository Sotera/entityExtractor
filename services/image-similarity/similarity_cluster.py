from running_stat import RunningStat
import math
import numpy as np


class SimilarityCluster:
    def __init__(self, similarity_threshold, initial_vector_id, initial_vector):
        self.variance = 0.0
        self.average_similarity_vector = initial_vector
        self.average_similarity = 1.0
        self.cosine_similarity_values = []
        self.similar_image_ids = [initial_vector_id]
        self.similarity_threshold = similarity_threshold
        self.mean = 0
        self.running_stat = RunningStat()

    def process_similarity(self, vector_id, vector):
        similarity = self.cosine_similarity(self.average_similarity_vector, vector)
        are_similar = similarity > self.similarity_threshold
        self.cosine_similarity_values.append(similarity)

        if are_similar:
            print "{} is similar to {}".format(vector_id, self.similar_image_ids[0])
            self.similar_image_ids.append(vector_id)
            self.average_similarity_vector = [n * .5 for n in [x + y for x, y in
                                                               zip(self.average_similarity_vector, vector)]]
            self.running_stat.push(similarity)
            self.variance = self.running_stat.variance()
            self.average_similarity = self.running_stat.mean()


        return are_similar

    @staticmethod
    def cosine_similarity(v1, v2):
        return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
