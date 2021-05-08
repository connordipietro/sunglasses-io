var http = require('http');
var fs = require('fs');
var finalHandler = require('finalhandler');
//var queryString = require('querystring');
var Router = require('router');
var bodyParser   = require('body-parser');
var uid = require('rand-token').uid;
//const Store = require('./store')

//state holding variables
let brands = [];
let users = [];
let products = [];
var accessTokens = [];
var failedLoginAttempts = {};
const TOKEN_VALIDITY_TIMEOUT = 15 * 60 * 1000;

// Setup router
var myRouter = Router();
myRouter.use(bodyParser.json());


let server = http.createServer(function (request, response) {
  	myRouter(request, response, finalHandler(request, response))
}).listen(3005, error => {
	if (error) {
		return console.log('Error starting server:', errror)
	}
	brands = JSON.parse(fs.readFileSync('./initial-data/brands.json', 'utf8'))
	products = JSON.parse(fs.readFileSync('./initial-data/products.json', 'utf8'))
	users = JSON.parse(fs.readFileSync('./initial-data/users.json', 'utf8'))
});

myRouter.get('/api/brands', function(request,response) {
	response.writeHead(200, { "Content-Type": "application/json" });
  return response.end(JSON.stringify(brands));
})

myRouter.get('/api/products', function(request, response) {
	response.writeHead(200, { "Content-Type": "application/json" });
	return response.end(JSON.stringify(products))
})

myRouter.get('/api/brands/:id/products', function(request, response) {
	const { id } = request.params
	const requestedBrand = brands.find(brand => brand.id == id)
	if (!requestedBrand) {
		response.writeHead(404);	
		return response.end("Requested brand not found");
	} else {
		const requestedBrandProducts = products.filter(product => product.categoryId == requestedBrand.id)
		response.writeHead(200, { "Content-Type": "application/json" });
		return response.end(JSON.stringify(requestedBrandProducts))
	}
})

// Helpers to get/set our number of failed requests per username
var getNumberOfFailedLoginRequestsForUsername = function(username) {
  let currentNumberOfFailedRequests = failedLoginAttempts[username];
  if (currentNumberOfFailedRequests) {
    return currentNumberOfFailedRequests;
  } else {
    return 0;
  }
}

var setNumberOfFailedLoginRequestsForUsername = function(username,numFails) {
  failedLoginAttempts[username] = numFails;
}

// Login call
myRouter.post('/api/me/login', function(request, response) {
  // Make sure there is a username and password in the request
  if (request.body.username && request.body.password && getNumberOfFailedLoginRequestsForUsername(request.body.username) < 3) {
    // See if there is a user that has that username and password
    let user = users.find((user) => {
      return user.login.username == request.body.username && user.login.password == request.body.password;
    });

    if (user) {
      // If we found a user, reset our counter of failed logins
      setNumberOfFailedLoginRequestsForUsername(request.body.username,0);

      // Write the header because we know we will be returning successful at this point and that the response will be json
      response.writeHead(200, {'Content-Type': 'application/json'});

      // We have a successful login, if we already have an existing access token, use that
      let currentAccessToken = accessTokens.find((tokenObject) => {
        return tokenObject.username == user.login.username;
      });

      // Update the last updated value so we get another time period
      if (currentAccessToken) {
        currentAccessToken.lastUpdated = new Date();
        return response.end(JSON.stringify(currentAccessToken.token));
      } else {
        // Create a new token with the user value and a "random" token
        let newAccessToken = {
          username: user.login.username,
          lastUpdated: new Date(),
          token: uid(16)
        }
        accessTokens.push(newAccessToken);
        return response.end(JSON.stringify(newAccessToken.token));
      }
    } else {
      // Update the number of failed login attempts
      let numFailedForUser = getNumberOfFailedLoginRequestsForUsername(request.body.username);
      setNumberOfFailedLoginRequestsForUsername(request.body.username,++numFailedForUser);
      // When a login fails, tell the client in a generic way that either the username or password was wrong
      response.writeHead(401, "Invalid username or password");
      return response.end();
    }
  } else {
    // If they are missing one of the parameters, tell the client that something was wrong in the formatting of the response
    response.writeHead(400, "Incorrectly formatted response");
    return response.end();
  }
});


// Helper method to process access token
var getValidTokenFromRequest = function(request) {
  var parsedUrl = require('url').parse(request.url,true)
  if (parsedUrl.query.accessToken) {
    // Verify the access token to make sure its valid and not expired
    let currentAccessToken = accessTokens.find((accessToken) => {
      return accessToken.token == parsedUrl.query.accessToken && ((new Date) - accessToken.lastUpdated) < TOKEN_VALIDITY_TIMEOUT;
    });
    if (currentAccessToken) {
      return currentAccessToken;
    } else {
      return null;
    }
  } else {
    return null;
  }
};



















module.exports = server;