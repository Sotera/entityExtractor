from math import exp

def exp_inv(r):
    return 1./(1.+exp(r))

def inv(r):
    return 1./(1.+r)

class GeoHandler:
    def __init__(self, weight_func=None):
        if weight_func is None or weight_func == 'exp_inv':
            self.weight = exp_inv
        elif weight_func=='inv':
            self.weight = inv
        else:
            print("Error: Function name not recognized, using default")
            self.weight = exp_inv

    def get_tweet_geo_features(self, tweet):
        l_geo = []
        if tweet['place'] is not None:
            bb = tweet['place']['bounding_box']['coordinates'][0]
            box = [bb[0][1], bb[1][1], bb[0][0], bb[2][0]]
            r = (box[1]-box[0])*(box[1]-box[0]) + (box[3]-box[2])*(box[3]-box[2])
            weight = self.weight(r)
            l_geo.append({"type":"box",
                          "coord":box,
                          "weight":weight,
                          "name":tweet['place']['full_name']})
        if tweet['geo'] is not None:
            point = tweet['geo']['coordinates']
            label = str(int(point[0]*100)*1./100.) + "_"  + str(int(point[1]*100)*1./100.)
            l_geo.append({"type":"point",
                          "coord":point,
                          "weight":1,
                          "name":label})
        #if tweet['location'] is not None:
            # [TODO: GEO BOUNDING SERVICE BASED ON LOCATION]
            #l_geo.append({"type":"user_loc",
            #              "coord":->from loc service
            #              "weight":->
            #              "name":tweet['location']
        return l_geo

    def rank_locations(self, l_tweets):
        d_loc = {}
        for tweet in l_tweets:
            if tweet['name'] in d_loc:
                d_loc['name']['weight'] += tweet['weight']
            else:
                d_loc[tweet['name']] = tweet

        ranked = sorted(d_loc.values(),key=lambda x: x['weight'], reverse=True)
        if len(ranked) < 5:
            return ranked
        else:
            return ranked[:5]

