import numpy.linalg as linalg
from itertools import starmap
from operator import mul


class CosineSimilarityAggregator:
    '''
    Modified from feature-similarity-clustering/similarity_cluster.py

    '''
    def __init__(self, similarity_threshold, similar_ids,
        average_similarity_vector, initial_image_url=None):

        self.valid_cluster = True
        self.average_similarity_vector = average_similarity_vector
        self.normalized_average_similarity_vector = linalg.norm(average_similarity_vector)
        self.similar_ids = similar_ids
        if initial_image_url is not None:
            self.similar_image_urls = [initial_image_url]
        else:
            self.similar_image_urls = None
        self.similarity_threshold = float(similarity_threshold)

    def process_similarity(self, vector_id, vector, image_url=None):
        vector_normalized = linalg.norm(vector)

        similarity = self.cosine_similarity(
            self.average_similarity_vector,
            self.normalized_average_similarity_vector,
            vector, vector_normalized)
        are_similar = similarity > self.similarity_threshold

        if are_similar:
            self.apply_vector_to_average(vector)
            self.similar_ids.append(vector_id)
            if image_url is not None:
                self.similar_image_urls.append(image_url)

        return are_similar

    def apply_vector_to_average(self, vector):
        # import pdb;pdb.set_trace()
        self.average_similarity_vector = [
            n / (len(self.similar_ids)+1)
            for n in [
                (x * len(self.similar_ids)) + y for x, y in
                zip(self.average_similarity_vector, vector)
            ]
        ]
        self.normalized_average_similarity_vector = linalg.norm(
            self.average_similarity_vector)

    @staticmethod
    def cosine_similarity(v1, normalized_v1, v2, normalized_v2):
        return sum(starmap(mul, zip(v1, v2))) / (normalized_v1 * normalized_v2)
