from datetime import datetime

def ms_from_dt(dt):
    return (dt - datetime.utcfromtimestamp(0)).total_seconds() * 1000

def dt_from_ms(ms):
    return datetime.fromtimestamp(ms/1000.)

def str_to_dt(str_dt, format=1):
    if format==1: #ex: 2014-08-10T01:59:31.979Z - GNIP Raw data, mongo SMP "created"
        return datetime.strptime(str_dt[:-5], "%Y-%m-%dT%H:%M:%S.000Z")
    else:
        print "Unrecongnized format"
        return None

def ms_time_interval(dt1, dt2):
    return (dt1 - dt2).total_seconds() * 1000

