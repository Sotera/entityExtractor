
from datetime import datetime
import json
import traceback
from os import getenv
import math_utils
from loopy import Loopy
from switch import switch
from operator import itemgetter as iget

MIN_ANNOTATION_MATCH_SCORE = float(getenv('MIN_ANNOTATION_MATCH_SCORE', 0.6))

def to_qcr_format(rec, job, campaign_thresh = 0.7, debug=False):
    if debug:
        print "Start conv, doing location"
        print "rec['location'] = ", rec['location']

    loc = sorted(rec['location'], key=iget('weight'), reverse=True)
    o_loc = None
    if len(loc):
        o_loc = {
            "type": "Point",
            "coordinates": [
                loc[0]["coords"][0]["lng"],
                loc[0]["coords"][0]["lat"]
            ]
        }
    if debug:
        print "Splitting campaigns"
    l_rec = []
    camps = filter(lambda x: x is not None, map(lambda x: [y for y in x.iteritems()][0] if x.values()[0] > campaign_thresh else None, rec['campaigns']))
    if debug:
        print "Max campaign association:", max([x.values()[0] for x in rec['campaigns']])
        print "n recs to transform: ", len(camps)
    for camp in camps:
        keywords = map(iget(0), sorted(rec['keywords'], key=iget(1), reverse=True))
        hashtags = map(iget(0), sorted(rec['hashtags'], key=iget(1), reverse=True))
        # per QCR: send top kwd if no hashtags
        if not len(hashtags):
            hashtags = [keywords[0]]

        event = {
            'uid': rec['id'],
            'label': rec['hashtags'][0][0] if len(rec['hashtags']) else
                rec['keywords'][0][0] if len(rec['keywords']) else 'None',
            'relevant': True,
            'startDate': datetime.fromtimestamp(rec['start_time_ms']/1000.0).isoformat(),
            'endDate': datetime.fromtimestamp(rec['end_time_ms']/1000.0).isoformat(),
            'hashtags': hashtags,
            'keywords': keywords,
            'urls': rec['urls'],
            'photos': rec['image_urls'],
            'importanceScore': camp[1],
            'topicMessageCount': rec['topic_message_count'],
            'campaignId': camp[0],
            'newsEventIds': [],
            'location': o_loc
        }
        if len(rec["hashtags"])>0:
            annotate_event(event, {"features":rec['hashtags']}, job)
        l_rec.append(event)

    return l_rec


def annotate_event(event, event_features, job):
    print 'annotating community: '

    annotations_url = '{}annotations'.format(job['api_root'])

    query_params = [{
        'query_type': 'where',
        'property_name': 'campaign',
        'query_value': event['campaignId']
    }]

    loopy = Loopy(annotations_url, query_params)

    # if no events in prior window, create new event
    if loopy.result_count == 0:
        print 'no annotations found'
        return

    matched_relevant_annotation, match_relevant_score = None, 0
    matched_label_annotation, match_label_score = None, 0

    while True:
        page = loopy.get_next_page()
        if page is None:
            break
        for annotation in page:
            score = math_utils.dot_comparison(event_features, annotation, key='features')
            print 'score: {}'.format(score)
            for case in switch(annotation['type'].lower()):
                if case('label'):
                    if score > match_label_score:
                        match_label_score = score
                        matched_label_annotation = annotation
                    break
                if case('relevant'):
                    if score > match_relevant_score:
                        match_relevant_score = score
                        matched_relevant_annotation = annotation
                    break
                if case():
                    print('huh?')

    if matched_label_annotation is not None and match_label_score >= MIN_ANNOTATION_MATCH_SCORE:
        event['label'] = matched_label_annotation['name']
    if matched_relevant_annotation is not None and match_relevant_score >= MIN_ANNOTATION_MATCH_SCORE:
        event['relevant'] = matched_relevant_annotation['relevant']


def stream_events(l_clusts, job, debug=False):
    print "Converting to QCR format"
    kafka_url = job['kafka_url']
    kafka_topic = job['kafka_topic']
    try:
        kds = []
        for clust in l_clusts:
            kds.extend(to_qcr_format(clust, job, debug=debug))
    except Exception as exc:
        print exc
        traceback.print_exc()

    if kafka_url == 'print':
        print "Printing events to console instead of sending them to kafka."
        for doc in kds:
            for k, v in doc.iteritems():
                print k, v
        return

    #wait until the very last second to import these kafka packages
    from kafka import KafkaProducer
    from kafka.errors import KafkaError
    producer = KafkaProducer(bootstrap_servers=kafka_url, value_serializer=lambda v: json.dumps(v).encode('utf-8'))
    print "Streaming Events"
    for doc in kds:
        try:
            state = producer.send(kafka_topic, doc)
            record_metadata = state.get(timeout=10)
            print (record_metadata.topic)
            print (record_metadata.partition)
            print (record_metadata.offset)
        except KafkaError as err:
            traceback.print_exc()
