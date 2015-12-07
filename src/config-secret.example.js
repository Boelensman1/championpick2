require('babel/polyfill');

const environment = {
  development: {
    isProduction: false
  },
  production: {
    isProduction: true
  }
}[process.env.NODE_ENV || 'development'];

module.exports = Object.assign({
  riotApiKey: 'aaaaaaaa-bbbb-1111-2222-cccccccccccc',
  dbPass: 'databasepassword',
}, environment);
