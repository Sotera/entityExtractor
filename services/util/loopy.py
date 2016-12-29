from __future__ import print_function
import requests
import math
from switch import switch

'''
pronounced 'Loo Py', not loopy:
A Python module that makes REST API calls to Loopback apps.
'''
class Loopy:
    def __init__(self, query_url, params, page_size=100, order_by='_id ASC'):
        # normalize url
        self.query_url = query_url.strip().rstrip('/') + '/'
        self.params = params
        self.total_returned = 0
        self.order_by = order_by # ex. 'price DESC'
        self.result_count = self.get_count()
        # get first doc id in results, to seed scrolling
        if self.result_count:
            self.scroll_id = self.get_first_id()
        self.page_size = page_size
        self.current_page = 0
        self.total_pages = int(math.ceil(float(self.result_count)/float(page_size)))

    def get_query_string(self, filter_prefix='filter'):
        query_string = '?'

        for param in self.params:
            for case in switch(param['query_type']):
                if case('between'):
                    layout = '{}[where][{}][{}][0]={}&{}[where][{}][{}][1]={}&'
                    query_string += layout.format(
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
                    query_string += '{}[{}][{}]={}&'.format(
                        filter_prefix,
                        param['query_type'],
                        param['property_name'],
                        param['query_value'])
                    break
                # ex. filter[where][name][inq]=foo&filter[where][name][inq]=bar
                if case('inq'):
                    for item in param['query_value']:
                        query_string += '{}[where][{}][inq]={}&'.format(
                            filter_prefix,
                            param['property_name'],
                            item)
                    break
                if case('neq'):
                    query_string += '{}[where][{}][neq]={}&'.format(
                        filter_prefix,
                        param['property_name'],
                        param['query_value'])
                    break
                if case():
                    # default, could also just omit condition or 'if True'
                    print('huh?')
        return query_string

    def get_first_id(self):
        findone_query_string = 'findone' + self.get_query_string() + \
            'filter[order]={}'.format(self.order_by)
        result = requests.get(self.query_url + findone_query_string).json()
        return result['id']

    def get_count(self):
        count_query_string = 'count' + self.get_query_string(filter_prefix='')
        try:
            result = None # init for err handler
            result = requests.get(self.query_url + count_query_string).json()
            return result['count']
        except Exception as e:
            print(e)
            print('Woops! Loopy says: error getting count from endpoint', result)
            return 0

    def get_next_page(self):
        if self.current_page == self.total_pages or self.result_count == 0:
            return None

        # 1st page must be leading-inclusive
        op = 'gt' if (self.current_page > 0) else 'gte'

        query_string = self.get_query_string() + \
           'filter[where][id][{}]={}&filter[limit]={}&filter[order]={}'.format(
            op, self.scroll_id, self.page_size, self.order_by)
        try:
            result = requests.get(self.query_url + query_string).json()
            if len(result):
                self.scroll_id = result[-1]['id']
        except Exception as e:
            print(e)
            print('Woops! Loopy says: error getting page from endpoint')
            return None

        self.current_page += 1
        self.total_returned += len(result)
        return result

    '''
    Send JSON data using specified http method (not just a POST).
    If url starts with '/', append to query_url.
    '''
    def post_result(self, url, json, method='POST'):
        if url.startswith('/'):
            url = self.query_url + url[1:]

        result = requests.request(method, url, json=json)
        if result.status_code != 200:
            print(result.content)
            raise Exception('POST to {} failed: {}'.format(
                url,
                result.content))
        else:
            return result.content

if __name__ == '__main__':
    query_params = [{
        'query_type': 'between',
        'property_name': 'timestamp_ms',
        'query_value': [1480432860000, 1480432866000]
    }]
    loopy = Loopy('http://172.17.0.1:3000/api/socialmediaposts', query_params)

    print(loopy.get_next_page())
    print(loopy.get_next_page())
