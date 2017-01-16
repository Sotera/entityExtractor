import community, sys, os, requests, uuid
import networkx as nx
from random import sample
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from loopy import Loopy
from sentiment_filters import SentimentFilter

class Louvaine:
    def __init__(self, base_url, ent_url, geo_url):
        self.graph = nx.Graph()
        self.nodes_detailed = {}
        stop_file = open(os.path.dirname(__file__) + '/files/' + 'stopWordList.txt', 'r')
        self.stop = set([])
        self.ent_url = ent_url
        self.geo_url = geo_url
        for line in stop_file:
            self.stop.add(line.strip('\n').strip('\r'))

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
        lp = Loopy(self.url + 'socialMediaPosts', query_params, page_size=500)
        page = lp.get_next_page()
        if page is None:
            return

        for doc in page:
            if doc['featurizer'] != cluster['data_type']:
                continue
            r = None
            try:
                r = requests.post(self.ent_url, data={'text':doc['text']})
            except:
                print 'error getting entities, ignoring'

            if 'campaigns' in doc:
                for cam in doc['campaigns']:
                    if cam in r_o["campaigns"]["ids"]:
                        r_o["campaigns"]["ids"][cam] += 1
                    else:
                        r_o["campaigns"]["ids"][cam] = 1

            if r is not None:
                for res in r.json():
                    if res['tag'] != 'LOCATION':
                        continue
                    rg = requests.post(self.geo_url, data={'address':res['label']})
                    for place in rg.json():
                        places.append(place)
                        break

            for word in [w for w in self.sf.pres_tokenize(doc['text'], doc['lang']) if w not in self.stop]:
                if word[0] == '#':
                    continue
                if word[:4]=='http':
                    websites.add(word)
                if word[:3]=='www':
                    websites.add('http://' + word)
                if word in words:
                    words[word] += 1
                else:
                    words[word] = 1

        for k, v in words.iteritems():
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
            query_params = [{"query_type":"between",
                     "property_name":"post_id",
                     "query_value":[id, id]
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
        checkpoints = [.1, .25, .5, .75, .9, .95, .99999, 1.1]
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
                    'hashtags':{},
                    'keywords':{},
                    'campaigns':{"total":0, 'ids':{}},
                    'urls':set([]),
                    'image_urls':[],
                    'location':{},
                    'importance_score':1.0,
                    'topic_message_count':len(clust['similar_post_ids'])}

            #Expand Summary data (hashtags, keywords, images, urls, geo)
            if clust['data_type'] == 'hashtag':
                d1[com]['hashtags'][clust['term']] = len(clust['similar_post_ids'])
                images |= self.get_img_sum(clust)
                #Add full text analysis, many communities have no image/text nodes
                self.get_text_sum(clust, d1[com])

            elif clust['data_type'] == 'image':
                images |= self.get_img_sum(clust)
            elif clust['data_type'] == 'text':
                images |= self.get_img_sum(clust)
                self.get_text_sum(clust, d1[com])

            d1[com]['image_urls'] = list(set(d1[com]['image_urls']) |images)

            #Make Sure Time is Correct
            if clust['start_time_ms'] < d1[com]['start_time_ms']:
                d1[com]['start_time_ms'] = clust['start_time_ms']
            if clust['end_time_ms'] > d1[com]['end_time_ms']:
                d1[com]['end_time_ms'] = clust['end_time_ms']

        print "Information collected, proceed cleaning up dictionaries"
        #Cleanup -> transform dicst to order lists, sets to lists for easy javascript comprehension
        for com in d1.keys():
            l_camps = []
            if d1[com]['campaigns']['total'] != 0:
                l_camps = [{k:1.*v/float(d1[com]['campaigns']['total'])} for k, v in d1[com]['campaigns']['ids'].iteritems()]

            d1[com]['campaigns'] = l_camps

            l_tags = map(lambda x: x[0], sorted([(k, v) for k, v in d1[com]['hashtags'].iteritems()], key=lambda x: x[1]))
            if len(l_tags) > 10:
                d1[com]['hashtags'] = l_tags[:10]
            else:
                d1[com]['hashtags'] = l_tags

            l_terms = map(lambda x: x[0], sorted([(k, v) for k, v in d1[com]['keywords'].iteritems()], key=lambda x: x[1]))
            if len(l_terms) > 10:
                d1[com]['keywords'] = l_terms[:10]
            else:
                d1[com]['keywords'] = l_terms

            d1[com]['urls'] = list(d1[com]['urls'])

            temp = []
            for k, v in d1[com]['location'].iteritems():
                dt = v
                dt['label'] = k
                temp.append(dt)
            d1[com]['location'] = temp


        return d1

    def save_communities(self):
        d1 = self.get_communities()
        print "Writing communities to mongo"
        for com in d1.values():
            if len(com['cluster_ids']) < 3:
                continue
            res = requests.post(self.url+'events/', json=com)
            print res
        return d1

