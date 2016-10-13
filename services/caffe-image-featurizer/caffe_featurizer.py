import numpy as np
import os
import sys
sys.path.append(os.getenv('CAFFE_PYTHON_PATH', '/home/caffe-user/caffe/python/'))
import caffe

class CaffeFeaturizer:
    net = None
    transformer = None
    files = []
    batch_size = None
    quiet = None

    def __init__(self, quiet=False):
        self.caffe_root = os.getenv('CAFFE_HOME', '/home/caffe-user/caffe/')
        self.model_path = os.getenv('CAFFE_MODEL_PATH', self.caffe_root + 'models/bvlc_reference_caffenet/')
        self.model = os.getenv('CAFFE_MODEL', 'bvlc_reference_caffenet.caffemodel')

        caffe.set_mode_cpu()
        self.net = caffe.Net(self.model_path + 'deploy.prototxt', self.model_path + self.model, caffe.TEST)
        transformer = caffe.io.Transformer({'data': self.net.blobs['data'].data.shape})
        transformer.set_transpose('data', (2, 0, 1))
        transformer.set_mean('data', np.load(self.caffe_root +
                                             'python/caffe/imagenet/ilsvrc_2012_mean.npy').mean(1).mean(1))
        transformer.set_raw_scale('data', 255)
        transformer.set_channel_swap('data', (2, 1, 0))
        self.transformer = transformer
        self.quiet = quiet

    def set_batch_size(self, n):
        self.batch_size = n
        self.net.blobs['data'].reshape(n, 3, 227, 227)

    def get_files(self):
        return self.files

    def set_files(self, files):
        self.files = files

    def load_files(self):
        self.errs = []
        i = 0
        for f in self.files:
            if i % 10 == 0:
                if not self.quiet:
                    print >> sys.stderr, i
            try:
                self.net.blobs['data'].data[i] = self.transformer.preprocess('data', caffe.io.load_image(f))
            except:
                if not self.quiet:
                    print >> sys.stderr, 'error at %s (%d)' % (f, i)
                self.errs.append(i)
            i += 1

    def forward(self):
        self.net.forward()

    def featurize(self, layer='fc7'):
        feat = [ self.net.blobs[layer].data[i] for i in range(self.batch_size)]

        return np.array(feat)
