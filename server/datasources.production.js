module.exports = {
  db: {
    connector: 'mongodb',
    connectionTimeout: 10000,
    host: process.env.DB_HOST || process.env.MONGO_HOST || 'mongo',
    port: process.env.DB_PORT || process.env.MONGO_PORT || 27017,
    database: process.env.DB_NAME || 'rancor'
  },
  cache: {
    connector: 'mongodb',
    connectionTimeout: 10000,
    host: process.env.CACHE_HOST || process.env.DB_HOST || process.env.MONGO_HOST || 'mongo',
    port: process.env.CACHE_PORT || process.env.DB_PORT || process.env.MONGO_PORT || 27017,
    database: process.env.CACHE_NAME || 'cache'
  }
};
