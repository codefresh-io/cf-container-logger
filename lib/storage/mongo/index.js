const MongoClient = require('mongodb').MongoClient;
let conf 			 		= require(`${__dirname}/conf.js`);


class MongoStorage {
	constructor(col) {
    this.col = col;
  }
	
  static init(colname) {
    return MongoClient.connect( conf.url, conf.opts )
      .then( db=>{
        
        return db.collection(colname);
      })
      .then( col=>{
        return new MongoStorage(col);
      })
  }

	logMessage(message) { // if timestamp of the message is needed it can be retrived from ObjectId, so I don't use additional timestamp field
		return this.col.insert( { msg: message } );
	}


}

module.exports = MongoStorage;
