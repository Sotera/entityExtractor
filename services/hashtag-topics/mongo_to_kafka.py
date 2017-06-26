from event_to_kafka import stream_events
from loopy import Loopy
import argparse

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("api_root", type=str, help="API root URL")
    parser.add_argument("-kafka_url", type=str, help="If writing events to kafka, specify url (default=None)", default=None)
    parser.add_argument("-kafka_topic", type=str, help="If writing event to kafka, specify topic (default=None)", default=None)
    parser.add_argument("--debug", help="Switch on for debugging", action='store_true')
    args = parser.parse_args()

    print "Debug:", args.debug

    print "Requesting Events"
    print "api_root = {}".format(args.api_root)
    r = Loopy.get("{}/api/events".format(args.api_root))

    stream_events(r, args.kafka_url, args.kafka_topic, debug=args.debug)

