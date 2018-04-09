const express = require( "express" );
const bodyParser = require( "body-parser" );
const FacebookTokenStrategy = require( "passport-facebook-token" );
const passport = require( "passport" );

const app = express();

// config express
app.use( bodyParser.json( {
    limit: "50mb"
} ) );

app.use( bodyParser.urlencoded( {
    limit: "50mb",
    extended: true
} ) );

// CORS headers
app.all( "*", function( req, res, next ) {
    res.header( "Access-Control-Allow-Origin", "*" );
    res.header( "Access-Control-Allow-Headers", "X-Requested-With, Content-Type" );

    next();
} );

const Datastore = require( "nedb" );

const db = {};

const config = {
    dataDir: "data",
    dbDir: "/db",
    ipAddress: "127.0.0.1",
    port: 8080
};

db.events = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/events.db`,
    autoload: true
} );

db.users = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/users.db`,
    autoload: true
} );

db.orgs = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/orgs.db`,
    autoload: true
} );

db.reservations = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/reservations.db`,
    autoload: true
} );

db.mcapikeys = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/mcapikeys.db`,
    autoload: true
} );

passport.use( new FacebookTokenStrategy( {
    clientID: 1691171894466083,
    clientSecret: "f5dc1360d37ed59e4c150eb061098055"
}, function( accessToken, refreshToken, profile, done ) {
    db.users.find( { facebookId: profile.id }, function ( error, user ) {
        if ( !user ) {
            db.users.insert( {
                profile
            }, function( err, newUser ) {
                return done( error, newUser );
            } );
        }
    } );
} ) );

app.get( "/orgs", ( req, res ) => {
    db.orgs.find( {}, ( err, orgs ) => {
        res.send( { orgs } );
    } );
} );

app.post(
    "/auth/facebook/token",
    passport.authenticate( "facebook-token" ),
    function ( req, res ) {
    // do something with req.user
        res.send( req.user ? 200 : 401 );
    }
);

app.get( "/events/:slug", ( req, res ) => {
    const { slug } = req.params;
    const lastThirtyDays = new Date( new Date().getTime() - daysInMiliseconds( 30 ) );

    db.orgs.findOne( { slug: slug.toLowerCase() }, ( err, org ) => {
        db.events.find( { orgId: org._id,
            date: {
                $gt: lastThirtyDays
            } }, ( secondErr, events ) => {
            res.send( { events } );
        } );
    } );
} );

app.listen( config.port, config.ipAddress, function() {
    console.log(
        "%s: Node server started on %s:%d ...",
        Date( Date.now() ),
        config.ipAddress,
        config.port
    );
} );

function daysInMiliseconds( days = 1 ) {
    return days * 8.64e+7;
}
