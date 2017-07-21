# misc. jupyter nb helper functions + settings.

import pandas as pd

# output all lines, not just the last one, in each cell.
from IPython.core.interactiveshell import InteractiveShell
InteractiveShell.ast_node_interactivity = 'all'

# wider pd dataframe columns.
pd.set_option('max_colwidth', 800)

# pretty-print spark dataframe info.
def pp(df, limit=10, raw=False):
    print(df.schema)
    print('count: ', df.count())
    if raw:
        return df.show(limit)
    else:
        return df.limit(limit).toPandas().head(limit)
