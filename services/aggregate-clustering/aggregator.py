import sys, os
sys.path.append(os.path.join(os.path.dirname(__file__), '../util'))
from loopy import Loopy
from similarity_cluster import SimilarityCluster
from numpy import linalg

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
            print(posts_cluster['average_similarity_vector'])
            # NOTE: a postscluster can be in 0 or 1 aggcluster
            for agg_cluster in aggregate_clusters:
                # break if we've already matched this postscluster with an aggcluster
                if posts_cluster['id'] in agg_cluster['posts_clusters_ids']:
                    break

                sim_cluster = try_aggregate(
                    agg_cluster, posts_cluster, job['similarity_threshold'])

                if sim_cluster:
                    agg_cluster['average_similarity_vector'] = sim_cluster.average_similarity_vector
                    agg_cluster['end_time_ms'] = posts_cluster['end_time_ms']
                    agg_cluster['posts_clusters_ids'].append(posts_cluster['id'])
                    agg_cluster['similar_post_ids'].extend(posts_cluster['similar_post_ids'])
                    # remove dupes
                    agg_cluster['similar_post_ids'] = list(set(agg_cluster['similar_post_ids']))
                    # remove nulls and dupes
                    agg_cluster['posts_clusters_ids']= list(filter(None.__ne__, set(agg_cluster['posts_clusters_ids'])))

                    aggregate_clusters_loopy.post_result(
                        url='{}/{}'.format(job['result_url'], agg_cluster['id']),
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
                    url=job['result_url'],
                    json={
                        'start_time_ms': posts_cluster['start_time_ms'],
                        'end_time_ms': posts_cluster['end_time_ms'],
                        'average_similarity_vector': posts_cluster['average_similarity_vector'],
                        'posts_clusters_ids': [posts_cluster['id']],
                        'similar_post_ids': posts_cluster['similar_post_ids'],
                        'data_type': posts_cluster['data_type']
                    }
                )

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
                    url='{}/{}'.format(job['result_url'], agg_cluster['id']),
                    json={'state': 'closed'},
                    method='PUT'
                )

def try_aggregate(agg_cluster, posts_cluster, similarity_threshold):
    curr_vector = posts_cluster['average_similarity_vector']

    sim_cluster = SimilarityCluster(
        similarity_threshold,
        agg_cluster['posts_clusters_ids'],
        agg_cluster['posts_clusters_ids'],
        agg_cluster['average_similarity_vector'],
        agg_cluster['start_time_ms'],
        agg_cluster['end_time_ms'])

    did_aggregate = sim_cluster.process_similarity(
        posts_cluster['id'],
        None,
        curr_vector,
        linalg.norm(curr_vector))

    print(sim_cluster.to_serializable_object())

    if did_aggregate:
        return sim_cluster
    else:
        return

def get_aggregate_clusters_loopy(job):
    query_params = [{
        'query_type': 'where',
        'property_name': 'state',
        'query_value': 'open'
    }]

    loopy = Loopy(job['result_url'], query_params)

    return loopy

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

    loopy = Loopy(job['query_url'], query_params)

    return loopy


if __name__ == '__main__':
    job = {
        'job_id': '580685e3ac69adc553661c85',
        'end_time_ms': '1476307511000',
        'query_url': 'http://172.17.0.1:3000/api/postsclusters',
        'result_url': 'http://172.17.0.1:3000/api/aggregateclusters',
        'similarity_threshold': '0.39',
        'max_time_lapse_ms': str(1000*60*60*8) # in hours
    }

    process(job)

    print(job)
