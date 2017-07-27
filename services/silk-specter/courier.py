# def: send data to other systems.

from kafka import KafkaProducer
from kafka.errors import KafkaError, KafkaTimeoutError
import traceback, json

# re-use producer instance.
producer = None

def deliver(topic, kafka_url='print', kafka_topic='print'):
    if kafka_url == 'print':
        print('kafka_url:', kafka_url)
        print(topic)
        return

    global producer
    producer = producer or KafkaProducer(bootstrap_servers=kafka_url,
        value_serializer=lambda v: json.dumps(v).encode('utf-8'))

    print('to kafka:', topic)
    try:
        state = producer.send(kafka_topic, to_qcr_format(topic))
        record_metadata = state.get(timeout=10)
        print(record_metadata.topic)
        print(record_metadata.partition)
        print(record_metadata.offset)
    except KafkaError as err:
        traceback.print_exc()
    except KafkaTimeoutError as err:
        traceback.print_exc()


def to_qcr_format(topic):
    topic.pop('created', None) # datetime not serializable
    topic.pop('post_ids', None)
    return topic
