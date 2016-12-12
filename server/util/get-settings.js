'use strict';

const app = require('../../server/server');

// def: return settings by list of key names

module.exports = function(keyNames, cb) {
  try {
    const keys = keyNames.map(key => {
        return { key };
      }),
      query = { where: { or: keys } };

    app.models.Setting.find(query, function(err, settings) {
      let retVal = {};
      keyNames.forEach(function(settingKey) {
        settings.forEach(function(setting) {
          if(setting.key === settingKey) {
            if(setting.type === 'boolean') {
              retVal[settingKey] = (setting.value !== 'false');
            } else if(setting.type === 'int') {
              retVal[settingKey] = parseInt(setting.value);
            } else if(setting.type === 'float') {
              retVal[settingKey] = parseFloat(setting.value);
            } else if(setting.type === 'object') {
              retVal[settingKey] = JSON.parse(setting.value);
            } else if(setting.type === 'string') {
              retVal[settingKey] = setting.value.toString();
            } else {
              retVal[settingKey] = setting.value;
            }
          }
        });
      });
      cb(null, retVal);
    });
  } catch (err) {
    cb(err);
  }
}
