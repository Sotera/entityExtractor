from running_stat import RunningStat
import math


class SimilarityCluster:
    def __init__(self, similarity_delta, initial_vector_id, initial_vector):
        print "init"
        self.standard_deviation = 0.0
        self.average_similarity_vector = initial_vector
        self.average_similarity = 1.0
        self.similar_image_ids = [initial_vector_id]
        self.similarity_delta = similarity_delta
        self.mean = 0
        self.running_stat = RunningStat()

    def process_similarity(self, vector_id, vector):
        similarity = self.cosine_similarity(self.average_similarity_vector, vector)
        are_similar = similarity > self.similarity_delta

        if are_similar:
            self.average_similarity = similarity if len(self.similar_image_ids) == 1 else \
                (self.average_similarity + similarity) * .5
            self.similar_image_ids.append(vector_id)
            self.average_similarity_vector = [n * .5 for n in [x + y for x, y in
                                                               zip(self.average_similarity_vector, vector)]]
            self.running_stat.push(similarity)
            self.standard_deviation = self.running_stat.standard_deviation()
            self.mean = self.running_stat.mean()

        return are_similar

    @staticmethod
    def cosine_similarity(v1, v2):
        dot_product = sum(n1 * n2 for n1, n2 in zip(v1, v2))
        magnitude1 = math.sqrt(sum(n ** 2 for n in v1))
        magnitude2 = math.sqrt(sum(n ** 2 for n in v2))
        similarity = dot_product / (magnitude1 * magnitude2)
        print similarity
        return similarity
