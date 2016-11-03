from __future__ import print_function
import requests
import math
import json
import urllib
from switch import switch

class Loopy:
    '''
    pronounced 'Loo Py', not loopy:
    A Python module that makes REST API calls to Loopback apps.
    '''
    def __init__(self, query_url, params, page_size=100, order_by='_id ASC'):
        # normalize url
        self.query_url = query_url.strip().rstrip('/')
        self.params = params
        self.page_size = page_size
        self.current_page = 0
        self.total_returned = 0
        self.order_by = order_by # ex. 'price DESC'
        self.result_count = self.get_count()
        self.total_pages = int(math.ceil(float(self.result_count)/float(page_size)))

    def get_query_string(self, limit, skip, order):
        and_dict = {"and": []}

        for param in self.params:
            for case in switch(param['query_type']):
                if case('between'):
                    between_dict = {param['property_name']: {"between": param['query_value']}}
                    and_dict['and'].append(between_dict)
                    break
                if case('where'):
                    where_dict = {param['property_name']: param['query_value']}
                    and_dict['and'].append(where_dict)
                    break
                if case('neq'):
                    between_dict = {param['property_name']: {"neq": param['query_value']}}
                    and_dict['and'].append(between_dict)
                    break
                if case():
                    # default, could also just omit condition or 'if True'
                    print('huh?')
        where_dict = {'where': and_dict, 'limit': limit, 'skip': skip, 'order':order}

        query_string = json.dumps(where_dict).replace(" ", "")

        return "?filter=" + urllib.quote_plus(query_string)

    def get_count_query_string(self):
        return '/count'

    def get_count(self):
        count_query_string = self.get_count_query_string()
        try:
            result = requests.get(self.query_url + count_query_string).json()
            return result['count']
        except Exception as e:
            print(e)
            print('Woops! Loopy says: error getting count from endpoint')
            return 0

    def get_next_page(self):
        if self.current_page == self.total_pages or self.result_count == 0:
            return None
        page = self.page_size

        if self.current_page == self.total_pages-1:
            page = self.result_count % self.page_size

        if self.page_size > self.result_count:
            page = self.result_count

        query_string = self.get_query_string(page, self.current_page*self.page_size, self.order_by)\

        try:
            result = requests.get(self.query_url + query_string).json()
        except Exception as e:
            print(e)
            print('Woops! Loopy says: error getting page from endpoint')
            return None

        self.current_page += 1
        self.total_returned += len(result)
        return result

    def post_result(self, url, json, method='POST'):
        ''' Handles POST or PUT requests '''
        result = requests.request(method, url, json=json)
        if result.status_code != 200:
            print(result.content)
            raise Exception('POST to {} failed: {}'.format(
                url,
                result.content))
