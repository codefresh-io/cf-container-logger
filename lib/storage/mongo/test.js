const MongoStorage = require('./index.js');
MongoStorage.init('container123').then( inst=>{
  inst.logMessage('Test message');
});
