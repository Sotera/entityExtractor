from running_stat import RunningStat
import numpy as np


class SimilarityCluster:
    def __init__(self, similarity_threshold, initial_vector_id, initial_vector):
        self.average_similarity_vector = initial_vector
        self.similar_image_ids = [initial_vector_id]
        self.similarity_threshold = similarity_threshold
        self.running_stat = RunningStat()

    def process_similarity(self, vector_id, vector):
        similarity = self.cosine_similarity(self.average_similarity_vector, vector)
        are_similar = similarity > self.similarity_threshold

        if are_similar:
            print "{} is similar to {}".format(vector_id, self.similar_image_ids[0])
            self.similar_image_ids.append(vector_id)
            self.apply_vector_to_average(vector)
            self.running_stat.push(similarity)

        return are_similar

    def apply_vector_to_average(self, vector):
        self.average_similarity_vector = [n * .5 for n in [x + y for x, y in
                                                           zip(self.average_similarity_vector, vector)]]

    def to_serializable_object(self):
        return {
            "variance": self.running_stat.variance(),
            "average_similarity_vector": self.average_similarity_vector,
            "average_similarity": self.running_stat.mean(),
            "similar_image_ids": self.similar_image_ids
        }

    @staticmethod
    def cosine_similarity(v1, v2):
        return np.dot(v1, v2) / (np.linalg.norm(v1) * np.linalg.norm(v2))
