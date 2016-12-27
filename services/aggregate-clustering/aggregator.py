import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from loopy import Loopy
from cosine_similarity_aggregator import CosineSimilarityAggregator

def process(job):
    aggregate_clusters_loopy = get_aggregate_clusters_loopy(job)
    aggregate_clusters = get_aggregate_clusters(aggregate_clusters_loopy)

    posts_clusters_loopy = get_posts_clusters_loopy(job)

    if posts_clusters_loopy.result_count == 0:
        print('No data to process')
        job['data'] = []
        job['state'] = 'processed'
        return

    while True:
        print('Scrolling {} posts_clusters... page {}'.format(
            posts_clusters_loopy.result_count,
            posts_clusters_loopy.current_page))

        page = posts_clusters_loopy.get_next_page()
        if not page:
            break

        for posts_cluster in page:
            # NOTE: a postscluster can be in 0 or 1 aggcluster
            if 'stats' in posts_cluster and posts_cluster['stats']['is_unlikely'] == 0:
                continue
            for agg_cluster in aggregate_clusters:
                # break if we've already matched this postscluster with an aggcluster
                if posts_cluster['id'] in agg_cluster['posts_clusters_ids']:
                    break
                aggregation = try_aggregate(agg_cluster, posts_cluster, job)
                if aggregation:
                    # hashtags don't calc average_similarity_vector
                    if job['data_type'] != 'hashtag':
                        agg_cluster['average_similarity_vector'] = aggregation.average_similarity_vector

                    agg_cluster['end_time_ms'] = posts_cluster['end_time_ms']
                    agg_cluster['posts_clusters_ids'].append(posts_cluster['id'])
                    agg_cluster['similar_post_ids'].extend(posts_cluster['similar_post_ids'])
                    # remove dupes
                    agg_cluster['similar_post_ids'] = list(set(agg_cluster['similar_post_ids']))
                    # remove nulls and dupes
                    agg_cluster['posts_clusters_ids'] = [x for x in set(agg_cluster['posts_clusters_ids']) if x is not None]

                    aggregate_clusters_loopy.post_result(
                        url='/{}'.format(agg_cluster['id']),
                        json={
                            'average_similarity_vector': agg_cluster['average_similarity_vector'],
                            'end_time_ms': agg_cluster['end_time_ms'],
                            'posts_clusters_ids': agg_cluster['posts_clusters_ids'],
                            'similar_post_ids': agg_cluster['similar_post_ids']
                        },
                        method='PUT'
                    )
                    break
            else:
                # no 'open' aggregate_clusters, or this postscluster didn't match
                # any aggregates
                aggregate_clusters_loopy.post_result(
                    url='/',
                    json={
                        'start_time_ms': posts_cluster['start_time_ms'],
                        'end_time_ms': posts_cluster['end_time_ms'],
                        'average_similarity_vector': posts_cluster.get('average_similarity_vector'),
                        'term': posts_cluster.get('term'),
                        'posts_clusters_ids': [posts_cluster['id']],
                        'similar_post_ids': posts_cluster['similar_post_ids'],
                        'data_type': posts_cluster['data_type'],
                        'lang': job.get('lang')
                    }
                )
    print("POST CLUSTER ITERATION COMPLETE")
    # exited top loop
    shut_down_aggregates(job)

def shut_down_aggregates(job):
    '''
    Update agg clusters that have not been extended (see end_time_ms)
    for a specified period of time.

    Ideally, we'd run a 'shutdown' routine outside of job monitors:
        Why? If job monitors run chronologically out of order, this could
        shutdown agg clusters before they are fully baked.
    '''
    loopy = get_aggregate_clusters_loopy(job)

    while True:
        print('Scrolling {} aggregate_clusters... page {}'.format(
            loopy.result_count,
            loopy.current_page))

        page = loopy.get_next_page()
        if not page:
            break

        for agg_cluster in page:
            cutoff_time_ms = int(job['end_time_ms']) - int(job['max_time_lapse_ms'])
            if int(agg_cluster['end_time_ms']) < cutoff_time_ms:
                loopy.post_result(
                    url='/{}'.format(agg_cluster['id']),
                    json={'state': 'closed'},
                    method='PUT'
                )

def try_aggregate(agg_cluster, posts_cluster, job):
    # hashtags don't calc average_similarity_vector
    if job['data_type'] == 'hashtag':
        # aggregate if exact match
        return agg_cluster['term'] == posts_cluster['term']
    else:
        similarity_threshold = job['similarity_threshold']
        curr_vector = posts_cluster['average_similarity_vector']

        aggregation = CosineSimilarityAggregator(
            similarity_threshold,
            agg_cluster['posts_clusters_ids'],
            agg_cluster['average_similarity_vector'])

        did_aggregate = aggregation.process_similarity(
            posts_cluster['id'],
            curr_vector)

        if did_aggregate:
            return aggregation
        else:
            return

def get_aggregate_clusters_loopy(job):
    query_params = [{
        'query_type': 'where',
        'property_name': 'state',
        'query_value': 'open'
    },
    {
        'query_type': 'where',
        'property_name': 'data_type',
        'query_value': job['data_type']
    }]

    if 'lang' in job and job['data_type'] == 'text':
        query_params.append({
            'query_type': 'where',
            'property_name': 'lang',
            'query_value': job['lang']
        })

    return Loopy(job['result_url'], query_params)

def get_aggregate_clusters(loopy):
    aggregate_clusters = []
    while True:
        print('Scrolling {} aggregate_clusters... page {}'.format(
            loopy.result_count,
            loopy.current_page))
        page = loopy.get_next_page()
        if not page:
            break
        aggregate_clusters.extend(page)

    return aggregate_clusters

def get_posts_clusters_loopy(job):
    query_params = [{
        'query_type': 'where',
        'property_name': 'job_monitor_id',
        'query_value': job['job_id']
    }]

    return Loopy(job['query_url'], query_params)


if __name__ == '__main__':
    job = {
        'job_id': '580685e3ac69adc553661c85',
        'data_type': 'text',
        'lang': 'en',
        'end_time_ms': '1476307511000',
        'query_url': 'http://172.17.0.1:3000/api/postsclusters',
        'result_url': 'http://172.17.0.1:3000/api/aggregateclusters',
        'similarity_threshold': '0.39',
        'max_time_lapse_ms': str(1000*60*60*8) # in hours
    }

    # job = {
    #     'job_id': '58068882dbb537655b9846e5',
    #     'data_type': 'hashtag',
    #     'end_time_ms': '1476308711000',
    #     'query_url': 'http://172.17.0.1:3000/api/postsclusters',
    #     'result_url': 'http://172.17.0.1:3000/api/aggregateclusters',
    #     'similarity_threshold': '0.39',
    #     'max_time_lapse_ms': str(1000*60*60*8) # in hours
    # }

    process(job)

    print(job)
