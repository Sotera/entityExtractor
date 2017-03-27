from __future__ import division
from loopy import Loopy
from os import getenv
import math_utils

MIN_MATCH_SCORE = float(getenv('MIN_MATCH_SCORE', 0.6))

print 'min match score:', MIN_MATCH_SCORE

# com == community, a potential event
def match_and_create_event(com, job):
    print 'Matching community: ', com['keywords'], com['hashtags']

    events_url = '{}events'.format(job['api_root'])

    # get prior events: end_time == job.start_time - 1ms
    query_params = [{
        'query_type': 'where',
        'property_name': 'end_time_ms',
        'query_value': int(job['start_time']) - 1
    }]

    loopy = Loopy(events_url, query_params)

    # if no events in prior window, create new event
    if loopy.result_count == 0:
        print 'no prior event found'
        create_event(loopy, com)
        return

    matched_event, match_score = None, 0

    while True:
        page = loopy.get_next_page()

        if page is None:
            break

        for event in page:
            # score this com against each event, eventually take highest
            score = math_utils.dot_comparison(com, event)
            print 'score: {}'.format(score)
            if score > match_score:
                match_score = score
                matched_event = event

    # is score above threshold?
    # then add link to new event
    if match_score >= MIN_MATCH_SCORE:
        com['sibling_id'] = matched_event.id

    create_event(loopy, com)

def create_event(loopy, com):
    print 'creating event'
    print 'keywords: {}\nhashtags: {}'.format(com['keywords'], com['hashtags'])
    return loopy.post_result('/', json=com)
