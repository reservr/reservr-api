const Joi = require( "joi" );

const eventSchema = Joi.object().keys( {
    name: Joi.string()
        .min( 3 )
        .required(),
    orgId: Joi.string()
        .min( 3 )
        .required(),
    description: Joi.string()
        .min( 3 )
        .required(),
    images: Joi.array().items( Joi.object().keys( {
        path: Joi.string()
    } ) ),
    date: Joi.date().required(),
    seats: Joi.number()
        .integer()
        .min( 3 ),
    published: Joi.boolean(),
    reminders: Joi.boolean(),
    reservationsOpen: Joi.boolean(),
    prices: Joi.array().items( Joi.object().keys( {
        name: Joi.string(),
        amount: Joi.number(),
        currency: Joi.string()
    } ) ),
    location: Joi.string()
        .min( 3 )
        .required(),
    timecreated: Joi.date().required(),
    invited: Joi.number().integer(),
    waiting: Joi.number().integer()
} );

module.exports = function( config, db ) {
    const get = function( req, res ) {
        let { skip, limit } = req.query;
        const { start, end } = req.query;
        const { sortBy, direction } = req.query;

        skip = skip || 0;
        limit = limit || 10;

        const filterBy = {};
        const sort = {};

        if ( start && end ) {
            filterBy.date = {
                $gt: new Date( parseInt( start, 10 ) ),
                $lt: new Date( parseInt( end, 10 ) )
            };
        }

        if ( sortBy && direction ) {
            sort[ sortBy ] = direction === "asc" ? 1 : -1;
        }

        db.events
            .find( filterBy )
            .skip( skip )
            .limit( limit )
            .sort( sort )
            .exec( function( err, docs ) {
                if ( err ) {
                    res.status( 400 ).send( { message: err } );
                }

                res.send( { message: "success", events: docs.length } );
            } );
    };

    const getOne = function( req, res ) {
        db.events.findOne( { _id: req.params.id }, function( err, doc ) {
            if ( err ) {
                res.status( 400 ).send( { message: err } );
            }
            res.send( { message: "success", event: doc } );
        } );
    };

    // TODO: this needs to be implemented
    const deleteItem = function( req, res ) {
        db.events.findOne( { _id: req.params.id }, function( err, doc ) {
            if ( err ) {
                res.status( 400 ).send( { message: err } );
            }
            res.send( { message: "success", event: doc } );
        } );
    };

    const post = function( req, res ) {
        Joi.validate( req.body, eventSchema )
            .then( function( data ) {
                db.events.insert( data, function( err, newDoc ) {
                    if ( err ) {
                        res.status( 400 ).send( { message: err } );
                    }
                    res.send( { message: "success", event: newDoc } );
                } );
            } )
            .catch( function( err ) {
                res.status( 400 ).send( { message: err.message } );
            } );
    };

    const put = function( req, res ) {
        Joi.validate( req.body, eventSchema )
            .then( function( data ) {
                db.events.update( { _id: req.params.id }, data, {}, function( err, numReplaced ) {
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
