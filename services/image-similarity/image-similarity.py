import math
from operator import add

class SimilarityCluster:
    def __init__(self, similarity_delta, initial_data):
        print "init"
        self.standard_deviation = 0.0
        self.average_similarity_vectors = [initial_data.features]
        self.average_similarity = 1.0
        self.similar_image_ids = [initial_data.id]
        self.similarity_delta = similarity_delta

    def process_similarity(self, data_id, data_vectors):

        similarity = self.cosine_similarity(self.average_similarity_vectors, data_vectors)
        are_similar = similarity > self.similarity_delta

        if are_similar:
            self.average_similarity = (self.average_similarity + similarity) * .5
            self.similar_image_ids.append(data_id)
            self.average_similarity_vectors = map(add, self.average_similarity_vectors, data_vectors)

        return are_similar

    @staticmethod
    def cosine_similarity(v1, v2):
        dot_product = sum(n1 * n2 for n1, n2 in zip(v1, v2))
        magnitude1 = math.sqrt(sum(n ** 2 for n in v1))
        magnitude2 = math.sqrt(sum(n ** 2 for n in v2))
        return dot_product / (magnitude1 * magnitude2)





class ImageSimilarity:

    def __init__(self):
        print "init"



if __name__ == "__main__":
    #get data
    data = [[
            2.0112218856811523,
            0,
            0.4733978509902954,
            2.1764729022979736,
            0
          ],[
            2.0112218856811523,
            0,
            0.4733978509902954,
            2.1764729022979736,
            0
          ],[
            2.0112218856811523,
            0,
            0.4733978509902954,
            2.1764729022979736,
            0
          ]]
    imageSim = ImageSimilarity()
    sim = imageSim.cosim(data[0], data[1])
    print sim

