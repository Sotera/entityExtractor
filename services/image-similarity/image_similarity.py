from similarity_cluster import SimilarityCluster
import json


class ImageSimilarity:
    def __init__(self, similarity_threshold):
        self.similarity_threshold = similarity_threshold
        self.similarity_clusters = []

    def process_vector(self, vector_id, vector):
        i = 0
        for cluster in self.similarity_clusters:
            if cluster.process_similarity(vector_id, vector):
                print "similarity in %d" % i
                return
            i += 1
        self.similarity_clusters.append(SimilarityCluster(self.similarity_threshold, vector_id, vector))

    def get_clusters(self):
        return self.similarity_clusters

    def to_json(self):
        json_list = []
        for cluster in self.similarity_clusters:
            if len(cluster.similar_image_ids) == 1:
                continue
            json_list.append(cluster.to_serializable_object())
        return json.dumps(json_list)

    def get_cosine_similarity_values(self):
        values = []
        for cluster in self.similarity_clusters:
            values.extend(cluster.cosine_similarity_values)
        return values


if __name__ == "__main__":
    #get data
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

