'use strict';

// runs async so we have settings for later boot scripts
module.exports = function(app, cb) {
  const Setting = app.models.Setting;

  // Please use snake_case key names

  const settings = [
    {
      key: 'job_monitors',
      type: 'object',
      value: JSON.stringify(
        [
          { lang: 'en', featurizer: 'text', service_args: { similarity_threshold: 0.65 }  },
          { lang: 'ar', featurizer: 'text', service_args: { similarity_threshold: 0.65 }  },
          //{ featurizer: 'domain' },
          { featurizer: 'hashtag' },
          { featurizer: 'image', service_args: { similarity_threshold: 0.39 } }
        ]
      )
    }
  ];

  const createSettings = settings
    .map(setting => {
      return Setting.findOrCreate({ where: { key: setting.key } }, setting);
    });

  Promise.all(createSettings)
    .then(() => cb())
    .catch(console.error);
};
