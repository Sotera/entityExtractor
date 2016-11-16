from __future__ import print_function
import requests
import math
from switch import switch

'''
pronounced 'Loo Py', not loopy:
A Python module that makes REST API calls to Loopback apps.
'''
class Loopy:
    '''
    paging=True: loopy will use offset+limit query params for classic pagination.
    paging=False: use range queries instead, which bypass Mongo skip() perf.
    issues on large data sets.
    '''
    def __init__(self, query_url, params, page_size=100, order_by='_id ASC', paging=True):
        # normalize url
        self.query_url = query_url.strip().rstrip('/') + '/'
        self.params = params
        self.paging = paging
        self.total_returned = 0
        self.order_by = order_by # ex. 'price DESC'
        self.result_count = self.get_count()
        if self.paging:
            self.page_size = page_size
            self.current_page = 0
            self.total_pages = int(math.ceil(float(self.result_count)/float(page_size)))
        else:
            self.calculate_range()

    '''
    set intial values to support range queries
    '''
    def calculate_range(self):
        if len(map(lambda p: p['query_type'] == 'between', self.params)) > 1:
            print(
                '''
                WARNING: multiple between 'clauses' found.
                range values might be invalid.
                ''')

        # use first 'between' dict to find start, end values.
        # casts inputs as integer values.
        for param in self.params:
            if param['query_type'] == 'between':
                self.range_start = int(param['query_value'][0])
                self.rolling_start = self.range_start
                self.range_end = int(param['query_value'][1])
                span = self.range_end - self.range_start

                '''
                balance db calls against app memory usage. for larger sets, make
                more db calls to decrease chance of a large, dense set hogging
                memory. for smaller sets, make fewer db calls. this does not
                necessarily prevent a dense block from hogging memory.
                TODO: use a db count query before setting the range_interval.
                '''
                if self.result_count > 10000:
                    self.range_interval = span / 1000
                else:
                    self.range_interval = span / 100

                print('range_interval: {}'.format(self.range_interval))
                break
        else:
            raise Exception('no "between" param found to extract time range')

    def get_query_string(self, filter_prefix='filter', start_time=None, end_time=None):
        query_string = '?'

        for param in self.params:
            for case in switch(param['query_type']):
                if case('between'):
                    layout = '{}[where][{}][{}][0]={}&{}[where][{}][{}][1]={}&'
                    query_string += layout.format(
                        filter_prefix,
                        param['property_name'],
                        param['query_type'],
                        start_time or param['query_value'][0],
                        filter_prefix,
                        param['property_name'],
                        param['query_type'],
                        end_time or param['query_value'][1])
                    break
                if case('where'):
                    query_string += '{}[{}][{}]={}&'.format(
                        filter_prefix,
                        param['query_type'],
                        param['property_name'],
                        param['query_value'])
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

    def get_count_query_string(self):
        return 'count' + self.get_query_string(filter_prefix='')

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
        if not self.paging:
            raise Exception('paging is disabled')

        if self.current_page == self.total_pages or self.result_count == 0:
            return None
        page = self.page_size

        if self.current_page == self.total_pages-1:
            page = self.result_count % self.page_size

        if self.page_size > self.result_count:
            page = self.result_count

        query_string = self.get_query_string() + \
           'filter[limit]={}&filter[skip]={}&filter[order]={}'.format(
            page, self.current_page*self.page_size, self.order_by)
        try:
            result = requests.get(self.query_url + query_string).json()
        except Exception as e:
            print(e)
            print('Woops! Loopy says: error getting page from endpoint')
            return None

        self.current_page += 1
        self.total_returned += len(result)
        return result

    '''
    A non-paging version since there is no scrolling feature in Mongo
    and skipping is really slow on large data sets.
    '''
    def get_next_block(self):
        if self.paging:
            raise Exception('paging is enabled')

        if self.total_returned >= self.result_count:
            return None

        if self.range_interval == 0: # edge case
            range_end = self.range_end
        else:
            range_end = self.rolling_start + self.range_interval

        # don't go over original end_time
        if range_end > self.range_end:
            range_end = self.range_end

        query_string = self.get_query_string(
            start_time=self.rolling_start, end_time=range_end) + \
           'filter[order]={}'.format(self.order_by)

        try:
            result = requests.get(self.query_url + query_string).json()
            self.rolling_start = range_end + 1
            results_count = len(result)
            if results_count > 1000:
                print('got {} results'.format(results_count))
        except Exception as e:
            print(e)
            print('Woops! Loopy says: error getting page from endpoint')
            return None

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

if __name__ == '__main__':
    query_params = [{
        'query_type': 'between',
        'property_name': 'timestamp_ms',
        'query_value': [1477679223000, 1477679263000]
    }]
    loopy = Loopy('http://172.17.0.1:3000/api/socialmediaposts', query_params, paging=False)

    print(loopy.get_next_block())
    # loopy.get_next_block()
