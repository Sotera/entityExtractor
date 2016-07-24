'use strict';

module.exports = function(SocialMediaRecord) {
  // allow Create, ChangeStream only
  SocialMediaRecord.disableRemoteMethod('upsert', true);
  SocialMediaRecord.disableRemoteMethod('deleteById', true);
  SocialMediaRecord.disableRemoteMethod('updateAll', true);
  SocialMediaRecord.disableRemoteMethod('updateAttributes', false);
};
