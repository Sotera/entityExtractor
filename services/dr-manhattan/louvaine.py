import community, sys, os, uuid, traceback
import networkx as nx
from random import sample
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from loopy import Loopy
from text_utils import remove_punctuation
from sentiment_filters import SentimentFilter
from operator import itemgetter as iget

# big list: load it once
stop_path = os.path.join(os.path.dirname(__file__), 'files', 'stopWordList.txt')
stop_file = open(stop_path, 'r')
stop_list = {w.strip('\n').strip('\r') for w in stop_file}

class Louvaine:
    def __init__(self, base_url, geo_url):
        self.graph = nx.Graph()
        self.nodes_detailed = {}
        self.geo_url = geo_url
        self.sf = SentimentFilter()

        if base_url[-1] == '/':
            self.url = base_url
        else:
            self.url = base_url + '/'

    def add_node(self, cluster):
        n_id = cluster['id']
        self.graph.add_node(n_id)
        self.nodes_detailed[n_id] = cluster

    def add_edge(self, c_link):
        self.graph.add_edge(c_link['source'], c_link['target'], {'weight':c_link['weight']})

    def get_text_sum(self, cluster, r_o):
        n_posts = len(cluster['similar_post_ids'])
        l_sample = cluster['similar_post_ids']
        if n_posts > 30:
            l_sample = sample(cluster['similar_post_ids'], 30)
            n_posts = 30

        words = {}
        places = []
        websites = set([])
        r_o["campaigns"]["total"] += n_posts

        #TODO: fix query type once S.L. is fixed
        query_params = [{
            "query_type":"inq",
            "property_name":"post_id",
            "query_value":l_sample
        }]
        lp = Loopy(self.url + 'socialMediaPosts', query_params)
        page = lp.get_next_page()
        if page is None:
            return

        for doc in page:
            if doc['featurizer'] != cluster['data_type']:
                continue

            if 'campaigns' in doc:
                for cam in doc['campaigns']:
                    if cam in r_o["campaigns"]["ids"]:
                        r_o["campaigns"]["ids"][cam] += 1
                    else:
                        r_o["campaigns"]["ids"][cam] = 1

            locs = self.sf.extract_loc(doc['text'])
            for loc in locs:
                print 'Location:', loc.encode('utf-8')
                try:
                    geos = Loopy.post(self.geo_url, json={'address': loc})
                    for place in geos:
                        places.append(place)
                        break
                except Exception as e:
                    print "error getting locations from geocoder...continuing.", e
                    traceback.print_exc()

            tokens = [w for w in self.sf.pres_tokenize(doc['text'], doc['lang']) if w not in stop_list]
            for word in tokens:
                if word[0] == '#':
                    continue
                if word[0] == '@':
                    continue
                if word[:4] == 'http':
                    websites.add(word)
                    continue
                if word[:3] == 'www':
                    websites.add('http://' + word)
                    continue
                if word in words:
                    words[word] += 1
                else:
                    words[word] = 1

        for k, v in words.iteritems():
            k = remove_punctuation(k)
            if v < 5:
                continue
            if v in r_o['keywords']:
                r_o['keywords'][k] += v
            else:
                r_o['keywords'][k] = v

        for place in places:
            if type(place) is not dict:
                continue
            place_name = ''
            weight = 0.0
            if 'city' in place.keys():
                place_name = place['city'] + ' '
                weight += 1
            if 'state' in place.keys():
                place_name += place['state'] + ' '
                weight += .1
            if 'country' in place.keys():
                place_name += ' ' + place['country'] + ' '
                weight += .05
            if place_name in r_o['location']:
                r_o['location'][place_name]['weight'] += weight
            else:
                r_o['location'][place_name] = {
                    "type":"inferred point",
                    "geo_type":"point",
                    "coords":[{
                        "lat": place['latitude'],
                        "lng":place['longitude']}
                    ],
                    "weight":weight
                }

        for url in list(websites):
            r_o['urls'].add(url)

    def get_img_sum(self, cluster):
        n_posts = len(cluster['similar_post_ids'])
        l_sample = cluster['similar_post_ids']
        if n_posts > 100:
            l_sample = sample(cluster['similar_post_ids'], 100)

        imgs = set()

        #TODO: fix query type once S.L. is fixed
        for id in l_sample:
            query_params = [{
                "query_type": "between",
                "property_name": "post_id",
                "query_value": [id, id]
            }]
            lp = Loopy(self.url + 'socialMediaPosts', query_params)
            page = lp.get_next_page()
            if page is None:
                continue
            for doc in page:
                if 'primary_image_url' not in doc:
                    continue
                imgs.add(doc['primary_image_url'])
                break

        return imgs

    def get_communities(self):
        partition = community.best_partition(self.graph)
        d1 = {}

        print "Communities found, getting event summary information"
        n_nodes = len(self.graph.nodes())
        checkpoints = [.1, .25, .5, .75, .9, .95, .99, 1.1]
        ind_checked = 0
        n_checked = 0
        for n in self.graph.nodes():
            n_checked += 1
            while n_checked > checkpoints[ind_checked]*n_nodes:
                ind_checked += 1
                print "Finished {}% of nodes".format(checkpoints[ind_checked-1]*100)

            images = set()
            com = str(partition[n])
            if n not in self.nodes_detailed:
                print "{} not found in detailed node list...why????".format(n)
                continue
            clust = self.nodes_detailed[n]
            if com in d1:
                d1[com]['cluster_ids'].append(n)
                d1[com]['topic_message_count'] += len(clust['similar_post_ids'])
            else:
                d1[com] = {
                    'id': str(uuid.uuid4()),
                    'name': 'default',
                    'start_time_ms': clust['start_time_ms'],
                    'end_time_ms':clust['end_time_ms'],
                    'cluster_ids':[n],
                    'domains':{},
                    'hashtags':{},
                    'keywords':{},
                    'campaigns':{"total":0, 'ids':{}},
                    'urls':set([]),
                    'image_urls':[],
                    'location':{},
                    'importance_score':1.0,
                    'topic_message_count':len(clust['similar_post_ids'])}

            #Expand Summary data (hashtags, keywords, images, urls, geo, domains)
            if clust['data_type'] == 'hashtag':
                d1[com]['hashtags'][clust['term']] = len(clust['similar_post_ids'])
                #Add full text analysis, many communities have no image/text nodes
                self.get_text_sum(clust, d1[com])
            elif clust['data_type'] == 'domain':
                # TODO: Verify we don't need hashtag or a get_domain_sum function
                d1[com]['domains'][clust['term']] = len(clust['similar_post_ids'])
                self.get_text_sum(clust, d1[com])
            elif clust['data_type'] == 'image':
                pass
            elif clust['data_type'] == 'text':
                self.get_text_sum(clust, d1[com])

            images |= self.get_img_sum(clust)

            d1[com]['image_urls'] = list(set(d1[com]['image_urls']) |images)

            #Make Sure Time is Correct
            if clust['start_time_ms'] < d1[com]['start_time_ms']:
                d1[com]['start_time_ms'] = clust['start_time_ms']
            if clust['end_time_ms'] > d1[com]['end_time_ms']:
                d1[com]['end_time_ms'] = clust['end_time_ms']

        print "Information collected, formatting output"

        #Cleanup -> transform dicst to order lists, sets to lists for easy javascript comprehension
        for com in d1.keys():
            l_camps = []
            if d1[com]['campaigns']['total'] != 0:
                l_camps = [{k:1.*v/float(d1[com]['campaigns']['total'])} for k, v in d1[com]['campaigns']['ids'].iteritems()]

            d1[com]['campaigns'] = l_camps

            # l_tags = map(lambda x: x[0], sorted([(k, v) for k, v in d1[com]['hashtags'].iteritems()], key=iget(1)))
            l_tags = sorted(list(d1[com]['hashtags'].iteritems()), key=iget(1), reverse=1)
            d1[com]['hashtags'] = l_tags[:100] # slice

            # l_terms = map(lambda x: x[0], sorted([(k, v) for k, v in d1[com]['keywords'].iteritems()], key=lambda x: x[1]))
            l_terms = sorted(list(d1[com]['keywords'].iteritems()), key=iget(1), reverse=1)
            d1[com]['keywords'] = l_terms[:100] # slice

            d1[com]['urls'] = list(d1[com]['urls'])

            l_domains = map(lambda x: x[0], sorted([(k, v) for k, v in d1[com]['domains'].iteritems()], key=iget(1)))
            d1[com]['domains'] = l_domains[:10] # slice

            temp = []
            for k, v in d1[com]['location'].iteritems():
                dt = v
                dt['label'] = k
                temp.append(dt)
            d1[com]['location'] = temp

        return d1
