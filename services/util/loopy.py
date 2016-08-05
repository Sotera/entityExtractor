import urllib2
import json
import math
from switch import switch

# pronounced Loo Py, not loopy.  Loopback Python Module
class Loopy:
    def __init__(self, base_url, params, page_size=100):
        self.base_url = base_url
        self.params = params
        self.page_size = page_size
        self.current_page = 0
        self.total_returned = 0
        self.params = params
        self.result_count = self.get_count()
        self.total_pages = int(math.ceil(self.result_count/page_size))

    def get_query_string(self, filter_prefix="filter"):
        query_string = "?"

        for param in self.params:
            for case in switch(param['query_type']):

                if case('between'):
                    query_string += "{}[where][{}][{}][0]={}&{}[where][{}][{}][1]={}&".format(
                        filter_prefix,
                        param['property_name'],
                        param['query_type'],
                        param['query_value'][0],
                        filter_prefix,
                        param['property_name'],
                        param['query_type'],
                        param['query_value'][1])
                    break
                if case('where'):
                    query_string += "{}[{}][{}]={}&".format(filter_prefix,
                                                            param['query_type'],
                                                            param['property_name'],
                                                            param['query_value'])
                    break
                if case():  # default, could also just omit condition or 'if True'
                    print "huh?"
        return query_string

    def get_count_query_string(self):
        return "count" + self.get_query_string("")

    def get_count(self):
        count_query_string = self.get_count_query_string()
        try:
            result = json.load(urllib2.urlopen(self.base_url + count_query_string))
            return result['count']
        except:
            print "Woops! Loopy says: error getting count from Loopback endpoint"
            return 0

    def get_next_page(self):
        if self.current_page == self.total_pages or self.result_count == 0:
            return None
        page = self.page_size

        if self.current_page == self.total_pages-1:
            page = self.result_count%self.page_size

        if self.page_size > self.result_count:
            page = self.result_count

        query_string = self.get_query_string() + \
                       "filter[limit]={}&filter[skip]={}".format(page,
                                                                 self.current_page*self.page_size)
        try:
            result = json.load(urllib2.urlopen(self.base_url + query_string))
        except:
            print "Woops! Loopy says: error getting page from Loopback endpoint"
            return None

        self.current_page += 1
        self.total_returned += len(result)
        return result

