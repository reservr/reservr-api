const Joi = require( "joi" );

const reservationSchema = Joi.object().keys( {
    name: Joi.string()
        .min( 3 )
        .required(),
    email: Joi.string()
        .min( 3 )
        .required(),
    seats: Joi.number()
        .integer()
        .min( 1 ),
    eventId: Joi.string()
        .min( 3 )
        .required()
} );

module.exports = function( config, db ) {
    // curl -H "Content-Type: application/json" http://localhost:8080/reservations
    const get = function( req, res ) {
        db.reservations.find( {}, function( err, docs ) {
            if ( err ) {
                res.status( 400 ).send( { message: err } );
            }

            res.send( { message: "success", orgs: docs.length } );
        } );
    };

    // curl -H "Content-Type: application/json" http://localhost:8080/reservations/70FdPzFvqSOJ4NVA
    const getOne = function( req, res ) {
        db.reservations.findOne( { _id: req.params.id }, function( err, doc ) {
            if ( err ) {
                res.status( 400 ).send( { message: err } );
            }
            res.send( { message: "success", reservation: doc } );
        } );
    };

    // TODO: this needs to be implemented
    const deleteItem = function( req, res ) {
        db.reservations.findOne( { _id: req.params.id }, function( err, doc ) {
            if ( err ) {
                res.status( 400 ).send( { message: err } );
            }
            res.send( { message: "success delete", reservation: doc } );
        } );
    };

    // curl -d '{"name":"value1", "email":"sebastian.kovacs@gmail.com", "seats": "1", "eventId":"0ebAfdqsuP16vMEF"}' -H "Content-Type: application/json" -X POST http://localhost:8080/reservations
    const post = function( req, res ) {
        Joi.validate( req.body, reservationSchema )
            .then( function( data ) {
                db.reservations.insert( data, function( err, newDoc ) {
                    if ( err ) {
                        res.status( 400 ).send( { message: err } );
                    }
                    res.send( { message: "success", reservation: newDoc } );
                } );
            } )
            .catch( function( err ) {
                res.status( 400 ).send( { message: err.message } );
            } );
    };

    // curl -d '{"name":"value1", "email":"sebastian.kovacs@gmail.com", "seats": "2", "eventId":"0ebAfdqsuP16vMEF"}' -H "Content-Type: application/json" -X PUT http://localhost:8080/reservations/70FdPzFvqSOJ4NVA
    const put = function( req, res ) {
        Joi.validate( req.body, reservationSchema )
            .then( function( data ) {
                db.reservations.update( { _id: req.params.id }, data, {}, function(
                    err,
                    numReplaced
                ) {
                    if ( err ) {
                        res.status( 400 ).send( { message: err } );
                    }
                    res.send( { message: "success", numReplaced } );
                } );
            } )
            .catch( function( err ) {
                res.status( 400 ).send( { message: err.message } );
            } );
    };

    return {
        get,
        getOne,
        deleteItem,
        post,
        put
    };
};
