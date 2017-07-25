from kafka import KafkaProducer
from kafka.errors import KafkaError
import traceback, json

def deliver(topics, kafka_url='print', kafka_topic='print'):
    if kafka_url == 'print':
        print('sample of topics')
        for doc in topics[:3]:
            for k, v in doc.items():
                print(k, v)
        return

    producer = KafkaProducer(bootstrap_servers=kafka_url,
        value_serializer=lambda v: json.dumps(v).encode('utf-8'))

    for doc in topics:
        try:
            state = producer.send(kafka_topic, doc)
            record_metadata = state.get(timeout=10)
            print(record_metadata.topic)
            print(record_metadata.partition)
            print(record_metadata.offset)
        except KafkaError as err:
            traceback.print_exc()
        except KafkaTimeoutError as err:
            traceback.print_exc()
