'use strict';

module.exports = function(SocialMediaPost) {
  // prevent direct access to CRUD endpoints.
  // instead use Qcr.insert endpoint.
  SocialMediaPost.disableRemoteMethod('create', true);
  SocialMediaPost.disableRemoteMethod('upsert', true);
  SocialMediaPost.disableRemoteMethod('updateAll', true);
  SocialMediaPost.disableRemoteMethod('updateAttributes', false);
};
