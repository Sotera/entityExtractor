from __future__ import division
from loopy import Loopy
from os import getenv
from operator import itemgetter as iget

MIN_MATCH_SCORE = float(getenv('MIN_MATCH_SCORE', 0.6))
MIN_MATCH_COUNT = int(getenv('MIN_MATCH_COUNT', 10))

print 'settings:', MIN_MATCH_COUNT, MIN_MATCH_SCORE

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
            score = match_event(com, event, match_score)
            print 'score: {}'.format(score)
            if score > match_score:
                match_score = score
                matched_event = event

    # is score above threshold?
    # then extend existing event end time
    # else, create new event
    if match_score >= MIN_MATCH_SCORE:
        update_event(loopy, matched_event, job)
    else:
        create_event(loopy, com)

def match_event(com, event, match_score):
    return max([
        match_event_with(com, event, match_score, key='keywords'),
        match_event_with(com, event, match_score, key='hashtags')
    ])

# compare com to event and return score.
# key is a document field, like 'hashtags'.
def match_event_with(com, event, match_score, key):
    com_values = com.get(key, [])
    event_values = event.get(key, [])

    print 'len({}): '.format(key), len(com_values), len(event_values)
    # return 0 if not enough data for comparison
    if len(com_values) < MIN_MATCH_COUNT or len(event_values) < MIN_MATCH_COUNT:
        return 0

    # keywords are tuples (keyword, count) so check for that structure
    if len(com_values) and type(com_values[0]) == tuple:
        com_values = map(iget(0), com_values)
        event_values = map(iget(0), event_values)

    # rm dupes and get common items
    intersection = set(com_values) & set(event_values)
    # calc ratio of common items to total keywords
    score = len(intersection) / len(com_values)
    return score

def create_event(loopy, com):
    print 'creating event'
    print 'keywords: {}\nhashtags: {}'.format(com['keywords'], com['hashtags'])
    return loopy.post_result('/', json=com)

def update_event(loopy, event, job):
    print 'extending event'
    print 'keywords: {}\nhashtags: {}'.format(event['keywords'], event['hashtags'])
    return loopy.post_result('/{}'.format(event['id']),
        method='PUT',
        json={'end_time_ms': job['end_time'], 'extended': True})
