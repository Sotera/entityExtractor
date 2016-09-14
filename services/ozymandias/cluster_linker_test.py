import unittest
from cluster_linker import ClusterLinker

class ClusterLinkerTest(unittest.TestCase):

    def setUp(self):
        self.cluster_linker = ClusterLinker(0.4)

    def test_get_links_default_value(self):
        self.assertEqual(self.cluster_linker.get_links(), [])

    def test_get_links_validation(self):
        cluster1['similar_ids'] = [] # invalid: empty ids
        self.cluster_linker.add_clusters(cluster1, cluster2)
        self.assertEqual(self.cluster_linker.get_links(), [])

    def test_get_links_should_match(self):
        self.cluster_linker.add_clusters(cluster1, cluster2)
        self.assertEqual(self.cluster_linker.get_links(),
            [{
                'source': 2, 'common_ids': [30, 40], 'target': 1,
                'weight': 0.5, 'end_time_ms': 1
            }]
        )

    def test_get_links_should_not_match(self):
        self.cluster_linker.add_clusters(cluster1, cluster3)
        self.assertEqual(self.cluster_linker.get_links(), [])

cluster1 = {
    'id': 1,
    'similar_ids': [ 10, 20, 30, 40 ],
    'end_time_ms': 1
}
cluster2 = {
    'id': 2,
    'similar_ids': [ 30, 40, 50, 60 ],
    'end_time_ms': 2
}
cluster3 = {
    'id': 3,
    'similar_ids': [ 60, 70, 80, 90 ],
    'end_time_ms': 3
}

if __name__ == '__main__':
    unittest.main()
