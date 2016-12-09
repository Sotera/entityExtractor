'use strict';

const debug = require('debug')('load-settings');

module.exports = function(app, cb) {
  const Setting = app.models.Setting;

  // Please use snake_case key names

  const newSettings = [
    {
      key: 'job_monitors',
      type: 'object',
      value: JSON.stringify(
        [
          { lang: 'en', featurizer: 'text', service_args: { similarity_threshold: 0.65 }  },
          { lang: 'ar', featurizer: 'text', service_args: { similarity_threshold: 0.65 }  },
          { featurizer: 'hashtag' },
          { featurizer: 'image', service_args: { similarity_threshold: 0.39 } }
        ]
      )
    }
  ];

  newSettings.forEach(setting => {
    Setting.findOrCreate({ where: { key: setting.key } }, setting)
    .then(debug)
    .catch(console.error)
  })

  // fire and forget
  cb();
};
