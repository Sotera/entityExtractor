# misc. jupyter nb helper functions + settings.

import pandas as pd
import numpy as np

# output all lines, not just the last one, in each cell.
from IPython.core.interactiveshell import InteractiveShell
InteractiveShell.ast_node_interactivity = 'all'

# wider pd dataframe columns.
pd.set_option('max_colwidth', 800)

# pretty-print pd entiy or spark dataframe info.
def pp(df, limit=10, raw=False):
    if type(df) == np.ndarray:
        return pd.DataFrame(df).head(limit)
    elif type(df) == pd.core.frame.DataFrame:
        print(df.shape)
        return df.head(limit)
    elif type(df) == pd.core.series.Series:
        print(df.shape)
        return df.head(limit)
    else:
        print(df.schema)
        print('count: ', df.count())
        if raw:
            return df.show(limit)
        else:
            return df.limit(limit).toPandas().head(limit)
