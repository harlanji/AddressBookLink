'use strict'

const pg = require('pg');
const Hapi = require('hapi');
const fs = require('fs');


// iOS isn't Node friendly but we want to share the code...
//const bloomFilterJs = fs.readFileSync('./lib/bloom-filter.js','utf8');
//eval(bloomFilterJs);
const Filter = require('bloom-filter');


export default function main() {

  console.log('server main');

  //this initializes a connection pool
  //it will keep idle connections open for a 30 seconds
  //and set a limit of maximum 10 idle clients
  var pool = new pg.Pool(config);


  const server = new Hapi.Server();
  server.connection({port: 3000, host: '0.0.0.0'});

  server.route(PUT_route(pool));
  server.route(GET_route(pool));


  server.start((err) => {
    if (err) {
      throw err;
    }
    console.log(`Server running at: ${server.info.uri}`);
  });
}


// create a config to configure both pooling behavior
// and client options
// note: all config is optional and the environment variables
// will be read if the config is not present
const config = {
  user: 'bloombase', //env var: PGUSER
  database: 'bloombase', //env var: PGDATABASE
  password: 'bloombase123', //env var: PGPASSWORD
  host: 'localhost', // Server hosting the postgres database
  port: 5432, //env var: PGPORT
  max: 5, // max number of clients in the pool
  idleTimeoutMillis: 30000, // how long a client is allowed to remain idle before being closed
};


const PUT_route = (pool) => new Object({
  method: 'PUT',
  path: '/db/{base}/{identifier}',
  handler: function (request, reply) {
    let contactsHash = request.payload,
      base = request.params.base,
      identifier = request.params.identifier;

    console.log('put: ' + JSON.stringify(contactsHash));

    pool.connect(function (err, client, done) {
      if (err) {
        return console.error('error fetching client from pool', err);
      }

      client.query('select id, bloom from bloombase where base=$1 and id != $2', [base, identifier], function (err, result) {

        if (err) {
          return console.error('error running query', err);
        }

        let contactsBloom = new Filter(contactsHash);

        let possibleMatchesTo = [], possibleMatchesFrom = [];

        result.rows.forEach(function (r) {
          if (contactsBloom.contains(r.id)) { possibleMatchesTo.push(r.id); }

          let rowBloom = new Filter(JSON.parse(r.bloom));
          if (rowBloom.contains(identifier)) { possibleMatchesFrom.push(r.id); }
        });

        let possibleMatches = [].concat(possibleMatchesTo,possibleMatchesFrom);

        let newContactsBloom = Filter.create(Math.max(16, possibleMatches.length), 0.000000001);

        console.log('possible matches: ' + JSON.stringify(possibleMatches));

        possibleMatches.forEach(id =>  newContactsBloom.insert(id));

        client.query('insert into bloombase (id, base, bloom) values($1, $2, $3) on conflict (id,base) do update set bloom=$3', [identifier, base, JSON.stringify(contactsHash)], function (err, result) {
          if (err) {
            return console.error('error running insert query', err);
          }

          let response = newContactsBloom.toObject();

          console.log('replying: ' + JSON.stringify(response));


          reply(response);
        });
      });
    });
  }
});

const GET_route = (pool) => new Object({
  method: 'GET',
  path: '/db/{base}/{identifier}',
  handler: function (request, reply) {
   reply.ok();
  }
});


main();