import unittest
import numpy as np
from similarity_cluster import SimilarityCluster


class TestSimilarityCluster(unittest.TestCase):

    def test_positive_similarity_state(self):
        cluster = SimilarityCluster(.9, 0, 0, [1, 1, 1], 0, 0)
        cluster.process_similarity(1, 1, [1, 1, 1], np.linalg.norm([1, 1, 1]))
        self.assertTrue(cluster.valid_cluster)
        self.assertTrue(len(cluster.similar_ids) == 2)

    def test_negative_similarity_state(self):
        cluster = SimilarityCluster(.9, 0, 0, [1, 1, 1], 0, 0)
        cluster.process_similarity(1, 1, [5, 0, 2], np.linalg.norm([5, 0, 2]))
        self.assertTrue(cluster.valid_cluster)
        self.assertTrue(len(cluster.similar_ids) == 1)

    def test_empty_starting_vector(self):
        cluster = SimilarityCluster(.9, 0, 0, [], 0, 0)
        self.assertFalse(cluster.valid_cluster)

if __name__ == '__main__':
    unittest.main()
