# dir helpers
import os, errno, stat

def mkdir_p(path):
    """ 'mkdir -p' in Python > 2.5"""
    try:
        os.makedirs(path)
        # 0o = py3 octal
        os.chmod(path, 0o777)
    except OSError as exc:
        # pass if already exists
        if exc.errno == errno.EEXIST and os.path.isdir(path):
            pass
        else:
            raise
