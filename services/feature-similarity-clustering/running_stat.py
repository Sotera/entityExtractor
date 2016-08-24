import math


class RunningStat:
    def __init__(self):
        self.m_n = 0
        self.m_oldM = 0
        self.m_newM = 0
        self.m_oldS = 0
        self.m_newS = 0

    def clear(self):
        self.m_n = 0

    def push(self, x):
        self.m_n += 1
        if self.m_n == 1:
            self.m_oldM = self.m_newM = x
            self.m_oldS = 0.0
        else:
            self.m_newM = self.m_oldM + (x - self.m_oldM) / self.m_n
            self.m_newS = self.m_oldS + (x - self.m_oldM) * (x - self.m_newM)

        self.m_oldM = self.m_newM
        self.m_oldS = self.m_newS

    def num_data_values(self):
        return self.m_n

    def mean(self):
        return self.m_newM if (self.m_n > 0) else 0.0

    def variance(self):
        return self.m_newS / (self.m_n - 1) if (self.m_n > 1) else 0.0

    def standard_deviation(self):
        return math.sqrt(self.variance())
