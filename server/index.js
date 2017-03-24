'use strict'

const pg = require('pg');
const Hapi = require('hapi');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Phone = require('phone');

const AUTH0_CLIENT_SECRET = 'Ytd8voy4YV16UQQvv7-IMxlaSKSZybmAymQHOqmdcoUdV1w8qgsQXPUHU9jSE3qj';


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

  server.register(require('inert'), (err) => {

    if (err) {
      throw err;
    }

    server.connection({port: 3000, host: '0.0.0.0'});




    server.route(PUT_route(pool));
    server.route(GET_route(pool));
    server.route(CONFIG_route(pool));
    server.route(HEALTH_route(pool));
    server.route(APPLE_SITE_ASSOC_route); // here or in nginx? maybe nginx merges.... neato.


    server.start((err) => {
      if (err) {
        throw err;
      }
      console.log(`Server running at: ${server.info.uri}`);
    });

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

const APPLE_SITE_ASSOC_route = {
  method: 'GET',
  path: '/apple-app-site-association',
  handler: function (request, reply) {
    console.log('APPLE_SITE_ASSOC_route');
    reply.file('./apple-app-site-association');
  }
};

const PUT_route = (pool) => new Object({
  method: 'PUT',
  path: '/db/{base}/{identifier}',
  handler: function (request, reply) {
    let {base, identifier} = request.params,
      {contactsHash,authJwt} = request.payload;

    try {
      // { iss: 'https://analogzen.auth0.com/',
      // sub: 'sms|58d01929879f18288a7a0c07',
      //   aud: 'vkNfojPw5Ps73vnGbD8S1RxLlQM7agGc',
      //   exp: 1490103979,
      //   iat: 1490067979 }

      console.log(`put base=${base} identifier=${identifier}`);
      console.log(JSON.stringify(request.payload));


      let info;

      try {
        info = jwt.verify(authJwt, AUTH0_CLIENT_SECRET);

      } catch (e) {
        console.log('failed to verify token.');
        throw e;
      }

      console.log('jwt info:');
      console.log(JSON.stringify(info));



      if (info.exp < (new Date().getTime()/1000) || info.iss != 'https://analogzen.auth0.com/' || info.aud != 'vkNfojPw5Ps73vnGbD8S1RxLlQM7agGc') {
        console.log('invalid credentials');
        throw new Error('invalid credentials');
      }

      if (base != info.aud) {
        console.log('invalid db');
        throw new Error('invalid db');
      }

      console.log('checking credentials');


      axios({
        method: 'post',
        url: info.iss + 'tokeninfo',
        data: {id_token: authJwt},
        timeout: 5000
      }).then((response) => {

        console.log('userinfo response');


        let extraInfo = response.data;
        console.log(JSON.stringify(extraInfo));


        // name, picture, nickname, phone_number, phone_verified,  identities, user_id

        let phoneNumber = parsePhoneNumber(extraInfo.phone_number);

        // if (identifier != phoneNumber) {
        //   console.log('invalid identifier');
        //   throw new Error('invalid indentifier');
        // }

        pool.connect(function (err, client, done) {
          if (err) {
            return console.error('error fetching client from pool', err);
          }

          client.query('select id, bloom from bloombase where base=$1 and id != $2', [base, identifier], function (err, result) {

            if (err) {
              done();
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

            possibleMatches.forEach(id =>  newContactsBloom.insert(id));

            client.query('insert into bloombase (id, base, bloom) values($1, $2, $3) on conflict (id,base) do update set bloom=$3', [identifier, base, JSON.stringify(contactsHash)], function (err, result) {
              done();

              if (err) {
                return console.error('error running insert query', err);
              }


              let response = newContactsBloom.toObject();

              console.log('replying: ' + JSON.stringify(response));


              reply(response);
            });
          });
        });

        })
        .catch((error) => {
          if (error.response) {
            console.log('userinfo response server error');
            console.log(error);
          } else {
            console.log('userinfo response network error');
          }
        })


    } catch (e) {
      reply().code(401);
      return;
    }




  }
});


const CONFIG_route = (pool) => new Object({
  method: 'GET',
  path: '/config/{configName}', //'/db/{base}/{identifier}',
  handler: function (request, reply) {
    let base = request.params.configName;

    if (base == 'speeddial.io') {
      return reply({
        returnTo: ['https://speeddial.io/ablink-result'],
        authProvider: {
          type: 'auth0-lock',
          connection: 'sms',
          domain: 'analogzen.auth0.com',
          clientId: 'vkNfojPw5Ps73vnGbD8S1RxLlQM7agGc'}
        });
    }

    return reply().code(404);
  }
}); // 8kb works...

const GET_route = (pool) => new Object({
  method: 'GET',
  path: '/test', //'/db/{base}/{identifier}',
  handler: function (request, reply) {
    // 5 * 2000 = 10kb
    reply(`<a href="https://addressbook.link/v0/book/test/1234?data=${'a'.repeat(1 * Math.pow(1024, 2))}">click here 1m</a>`)
      .header('content-type', 'text/html');
  }
}); // 8kb works...


const HEALTH_route = (pool) => new Object({
  method: 'GET',
  path: '/health',
  handler: function (request, reply) {
    reply('ok');
  }
});

main();





function parsePhoneNumber (phoneNumber) {
  let digits = phoneNumber.split('').filter(char => char >= '0' && char <= '9').join('');
  let parsed = Phone(digits);

  if (parsed.length == 0) {
    console.log(`could not parse phone number ${phoneNumber} so normalized to ${digits}.`);

    return digits;
  }

  return parsed[0];
}