const express = require( "express" );
const bodyParser = require( "body-parser" );
const eventsController = require( "./eventsController" );
const multer = require( "multer" );
const fs = require( "fs" );
const sharp = require( "sharp" );

const Datastore = require( "nedb" );

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

app.use( express.static( "public" ) );

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

app.listen( config.port, config.ipAddress, function() {
    console.log(
        "%s: Node server started on %s:%d ...",
        Date( Date.now() ),
        config.ipAddress,
        config.port
    );
} );
