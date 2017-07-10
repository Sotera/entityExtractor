

import sys
import os
import traceback
sys.path.append(os.path.join(os.path.dirname(__file__), "../util"))
from entity_extractor import EntityExtractor
from loopy import Loopy

# big list: load it once
stop_path = os.path.join(os.path.dirname(__file__), 'files', 'stopWordList.txt')
stop_file = open(stop_path, 'r')
stop_list = {w.strip('\n').strip('\r') for w in stop_file}
ent_ext = EntityExtractor()


def max_pair(d):
    v = list(d.values())
    k = list(d.keys())
    return d[k[v.index(max(v))]]

class Locate:
    def __init__(self, base_url, geo_url, geo_threshold):
        self.geo_url = geo_url
        self.geo_threshold = geo_threshold

        if base_url[-1] == '/':
            self.url = base_url
        else:
            self.url = base_url + '/'

    def get_location(self, text):
        locs = ent_ext.extract(text, tag='I-LOC')
        location = {}
        places = []
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

        for place in places:
            if type(place) is not dict:
                continue
            place_name = ''
            street_name = ''
            zipcode = ''
            city = ''
            state = ''
            country = ''
            weight = 0.0

            if 'streetName' in place.keys():
                place_name = place['streetName'] + ' '
                street_name = place['streetName']
                weight += 2
            if 'zipcode' in place.keys():
                place_name = place['zipcode'] + ' '
                zipcode = place['zipcode']
                weight += 1.5
            if 'city' in place.keys():
                place_name = place['city'] + ' '
                city = place['city']
                weight += 1
            if 'state' in place.keys():
                place_name += place['state'] + ' '
                state = place['state']
                weight += .1
            if 'country' in place.keys():
                place_name += ' ' + place['country'] + ' '
                country = place['country']
                weight += .05
            if place_name in location:
                location[place_name]['weight'] += weight
                location[place_name]['street_name'] = street_name
                location[place_name]['zipcode'] = zipcode
                location[place_name]['city'] = city
                location[place_name]['state'] = state
                location[place_name]['country'] = country
            else:
                location[place_name] = {
                    "street_name": street_name,
                    "zipcode": zipcode,
                    "city": city,
                    "state": state,
                    "country": country,
                    "type": "Point",
                    "weight": weight,
                    "coordinates": [place['longitude'], place['latitude']]
                }

        location = dict((k, v) for k, v in location.items() if v['weight'] >= self.geo_threshold)
        if not location:
            return location
        return max_pair(location)
