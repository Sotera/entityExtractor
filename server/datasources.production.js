module.exports = {
  db: {
    connector: 'mongodb',
    connectionTimeout: 10000,
    host: process.env.DB_HOST || process.env.MONGO_HOST || 'mongo',
    port: process.env.DB_PORT || process.env.MONGO_PORT || 27017,
    database: process.env.DB_NAME || 'rancor'
  }
};
