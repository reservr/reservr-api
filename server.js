const express = require( "express" );
const bodyParser = require( "body-parser" );
const multer = require( "multer" );
const fs = require( "fs" );
const session = require( "express-session" );
const NedbStorage = require( "tch-nedb-session" )( session );
const Datastore = require( "nedb" );
const passport = require( "passport" );
const LocalStrategy = require( "passport-local" ).Strategy;
const bCrypt = require( "bcrypt-nodejs" );

const eventsController = require( "./eventsController" );
const orgsController = require( "./orgsController" );
const reservationsController = require( "./reservationsController" );
const usersController = require( "./usersController" );

// Generates hash using bCrypt
const createHash = function( password ) {
    return bCrypt.hashSync( password, bCrypt.genSaltSync( 10 ), null );
};

const validateEmail = function( email ) {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
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
    port: 9001
};

// initialise databases
db.events = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/events.db`,
    autoload: true
} );

db.orgs = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/orgs.db`,
    autoload: true
} );

db.users = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/users.db`,
    autoload: true
} );

db.reservations = new Datastore( {
    filename: `${ config.dataDir + config.dbDir }/reservations.db`,
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
        done( err, user._id );
    } );
} );

app.use( passport.initialize() );
app.use( passport.session() );

// CORS headers
app.all( "*", function( req, res, next ) {
    res.header( "Access-Control-Allow-Origin", "http://localhost:8082" );
    res.header( "Access-Control-Allow-Headers", "X-Requested-With, Content-Type" );
    res.header( "Access-Control-Allow-Credentials", "true" );
    next();
} );

// controllers
const events = eventsController( config, db );
const orgs = orgsController( config, db );
const reservations = reservationsController( config, db );
const users = usersController( config, db );

// users controller
app.get( "/users", isAuthenticated, users.getOne );

// events controller routes
app.get( "/events", events.get );
app.get( "/events/:id", events.getOne );
app.delete( "/events/:id", events.deleteItem );
app.post( "/events", events.post );
app.put( "/events/:id", events.put );

// orgs controller routes
app.get( "/orgs", orgs.get );
app.get( "/orgs/:id", orgs.getOneById );
app.delete( "/orgs/:id", orgs.deleteItem );
app.post( "/orgs", orgs.post );
app.put( "/orgs/:id", orgs.put );

// events controller routes
app.get( "/reservations", isAuthenticated, reservations.get );
app.get( "/reservations/:id", reservations.getOne );
app.delete( "/reservations/:id", reservations.deleteItem );
app.post( "/reservations", reservations.post );
app.put( "/reservations/:id", reservations.put );

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

app.get( "/logout", function( req, res, next ) {
    req.session.destroy( ( err ) => {
        if ( err ) {
            return next( err );
        }

        req.logout();

        return res.status( 200 ).clearCookie( "connect.sid", { path: "/" } ).send( { message: "logged out" } );
    } );
} );

app.post( "/login", function( req, res, next ) {
    passport.authenticate( "local", function( err, user ) {
        if ( err ) {
            return next( err );
        }

        if ( !user ) {
            return res.status( 401 ).send( { message: "user not found" } );
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

    if ( req.body.userType === "admin" && !req.body.orgName ) {
        res.status( 400 ).send( { message: "Organisation name is invalid or unspecified." } );
        return;
    }

    db.users.findOne( { username: req.body.username }, function( err, user ) {
        if ( err ) {
            res.status( 400 ).send( { message: err } );
            return;
        }

        if ( user ) {
            res.status( 400 ).send( { message: "There is already a user with this email." } );
            return;
        }

        // if it's admin, create an org
        if ( req.body.userType === "admin" ) {
            const org = {
                name: req.body.orgName,
                location: "",
                logo: "",
                confirmationEmail: req.body.username,
                locale: "RO"
            };

            db.orgs.insert( org, function( orgsError, newDoc ) {
                if ( orgsError ) {
                    res.status( 400 ).send( { message: orgsError } );
                }

                db.users.insert(
                    {
                        username: req.body.username,
                        password: createHash( req.body.password ),
                        orgId: newDoc._id,
                        userType: req.body.userType
                    },
                    function( usersError, newUser ) {
                        if ( usersError ) {
                            res.status( 400 ).send( { message: usersError } );
                            return;
                        }

                        req.login(
                            { username: newUser.username, password: newUser.password, _id: newUser._id },
                            function( loginError ) {
                                if ( loginError ) {
                                    res.status( 400 ).send( { message: loginError } );
                                    return;
                                }

                                res.send( { message: "signed up and logged in." } );
                            }
                        );
                    }
                );
            } );
        }

        if ( req.body.userType === "regular" ) {
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
                                res.status( 400 ).send( { message: loginError } );
                                return;
                            }

                            res.send( { message: "signed up and logged in." } );
                        }
                    );
                }
            );
        }
        // if it's a regular user, just and it to the db
    } );
} );

// is authenticated
function isAuthenticated( req, res, next ) {
    if ( req.user ) {
        return next();
    }

    return res.status( 401 ).send( { message: "Not logged in." } );
}

app.listen( config.port, config.ipAddress, function() {
    console.log(
        "%s: Node server started on %s:%d ...",
        Date( Date.now() ),
        config.ipAddress,
        config.port
    );
} );
