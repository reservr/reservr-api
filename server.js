const express = require( "express" );
const bodyParser = require( "body-parser" );
const eventsController = require( "./eventsController" );
const multer = require( "multer" );
const fs = require( "fs" );
const session = require( "express-session" );
const NedbStorage = require( "tch-nedb-session" )( session );
const Datastore = require( "nedb" );
const passport = require( "passport" );
const LocalStrategy = require( "passport-local" ).Strategy;

const bCrypt = require( "bcrypt-nodejs" );

// Generates hash using bCrypt
const createHash = function( password ) {
    return bCrypt.hashSync( password, bCrypt.genSaltSync( 10 ), null );
};

const validateEmail = function( email ) {
    const re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test( email );
};

const isValidPassword = function( user, password ) {
    return bCrypt.compareSync( password, user.password );
};

const expiration = 24 * 60 * 60 * 1000;

const sessionStore = new NedbStorage( {
    filename: "data/db/sessions.db",
    expiration,
    expirationType: "interval",
    autoCompactInterval: 15 * 60 * 1000,
    expirationInterval: 24 * 60 * 60 * 1000
} );

const storage = multer.diskStorage( {
    destination( req, file, cb ) {
        cb( null, "public/uploads" );
    },
    filename( req, file, cb ) {
        const splitName = file.originalname.split( "." );
        const ext = splitName[ splitName.length - 1 ];
        const filename = splitName
            .reverse()
            .slice( 1 )
            .reverse()
            .join( "." );

        cb( null, `${ filename }-${ Date.now() }.${ ext }` );
    }
} );

const upload = multer( { storage } );

/*
TODO:
- resize
- dropzone testing
*/

const app = express();
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

// config express
app.use( express.static( "public" ) );

app.use( session( {
    secret: "santa",
    cookie: {
        maxAge: expiration
    },
    resave: false,
    saveUninitialized: false,
    store: sessionStore
} ) );

app.use( bodyParser.json( {
    limit: "50mb"
} ) );

app.use( bodyParser.urlencoded( {
    limit: "50mb",
    extended: true
} ) );

passport.use( new LocalStrategy( { passReqToCallback: true }, function( req, username, password, done ) {
    db.users.findOne( { username }, function( err, user ) {
        if ( err ) {
            return done( err );
        }
        if ( !user ) {
            return done( null, false, { message: "Incorrect username." } );
        }
        if ( !isValidPassword( user, password ) ) {
            return done( null, false, { message: "Incorrect password." } );
        }
        return done( null, user, req );
    } );
} ) );

passport.serializeUser( function( user, done ) {
    done( null, user._id );
} );

passport.deserializeUser( function( id, done ) {
    db.users.findOne( { _id: id }, function( err, user ) {
        done( err, user );
    } );
} );

app.use( passport.initialize() );
app.use( passport.session() );

// CORS headers
app.all( "*", function( req, res, next ) {
    res.header( "Access-Control-Allow-Origin", "*" );
    res.header( "Access-Control-Allow-Headers", "X-Requested-With, Content-Type" );
    next();
} );

const events = eventsController( config, db );

app.get( "/events", events.get );
app.get( "/events/:id", events.getOne );
app.delete( "/events/:id", events.deleteItem );
app.post( "/events", events.post );
app.put( "/events/:id", events.put );

app.post( "/upload", upload.array( "photos", 12 ), function( req, res ) {
    res.send( {
        message: "success",
        images: req.files.map( f => ( {
            path: f.path
        } ) )
    } );
} );

app.delete( "/upload/:name", function( req, res ) {
    fs.unlink( `public/uploads/${ req.params.name }`, err => {
        if ( err ) {
            res.status( 400 ).send( { message: err } );
            return;
        }
        res.send( {
            message: "deleted",
            name: req.params.name
        } );
    } );
} );

/*
curl -X POST -d '{"username":"sebi.kovacs+26@gmail.com", "password":"12345678"}' -H "Content-Type: application/json" http://localhost:8080/login
curl -X POST -d '{"username":"sebi.kovacs+26@gmail.com", "password":"12345678"}' -H "Content-Type: application/json" http://localhost:8080/signup
*/

app.post( "/login", function( req, res, next ) {
    passport.authenticate( "local", function( err, user ) {
        if ( err ) {
            return next( err );
        }
        if ( !user ) {
            return res.send( { message: "user not found" } );
        }

        return req.logIn( user, function( loginError ) {
            if ( loginError ) {
                return res.send( { message: "error", error: loginError } );
            }
            return res.send( { message: "logged in" } );
        } );
    } )( req, res, next );
} );

app.post( "/signup", function( req, res ) {
    if ( !req.body.username || !req.body.password ) {
        res.status( 400 ).send( { message: "Username or password are incorrect." } );
        return;
    }

    if ( !validateEmail( req.body.username ) ) {
        res.status( 400 ).send( { message: "Email is invalid." } );
        return;
    }

    db.users.findOne( { username: req.body.username }, function( err, user ) {
        if ( err ) {
            res.status( 400 ).send( { message: err } );
            return;
        }

        if ( user ) {
            res.status( 400 ).send( { message: "there is already a user with this email" } );
            return;
        }

        db.users.insert(
            {
                username: req.body.username,
                password: createHash( req.body.password )
            },
            function( error, newDoc ) {
                if ( error ) {
                    res.status( 400 ).send( { message: error } );
                    return;
                }

                req.login(
                    { username: newDoc.username, password: newDoc.password, _id: newDoc._id },
                    function( loginError ) {
                        if ( loginError ) {
                            console.log( "logginError" );
                            console.log( loginError );
                            res.status( 400 ).send( { message: loginError } );
                            return;
                        }

                        res.send( { message: "logged in?" } );
                    }
                );
            }
        );
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
