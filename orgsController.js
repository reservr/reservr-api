const Joi = require( "joi" );

const orgSchema = Joi.object().keys( {
    name: Joi.string()
        .min( 3 )
        .required(),
    location: Joi.string()
        .min( 3 )
        .required(),
    logo: Joi.string().min( 3 ),
    confirmationEmail: Joi.string()
        .min( 3 )
        .required(),
    locale: Joi.string()
        .max( 2 )
        .required()
} );

module.exports = function( config, db ) {
    const get = function( req, res ) {
        const query = req.query.slug ? { slug: req.params.slug } : {};

        if ( req.user ) {
            db.users.findOne( { _id: req.user }, ( err, user ) => {
                if ( user.userType === "admin" ) {
                    db.orgs.findOne( { _id: user.orgId }, ( error, org ) => {
                        if ( error ) {
                            res.status( 400 ).send( { message: err } );
                            return;
                        }
                        res.send( { message: "success org", org } );
                    } );
                }
            } );
            return;
        }

        db.orgs.find( query, function( err, docs ) {
            if ( err ) {
                res.status( 400 ).send( { message: err } );
                return;
            }

            res.send( { message: "success", orgs: docs.length } );
        } );
    };

    const getOneById = function( req, res ) {
        db.orgs.findOne( { _id: req.params.id }, function( err, doc ) {
            if ( err ) {
                res.status( 400 ).send( { message: err } );
                return;
            }
            res.send( { message: "success", org: doc } );
        } );
    };

    // TODO: this needs to be implemented
    const deleteItem = function( req, res ) {
        db.orgs.findOne( { _id: req.params.id }, function( err, doc ) {
            if ( err ) {
                res.status( 400 ).send( { message: err } );
                return;
            }
            res.send( { message: "success delete", org: doc } );
        } );
    };

    const post = function( req, res ) {
        Joi.validate( req.body, orgSchema )
            .then( function( data ) {
                const name = convertNameToSlug( data.name );
                const newData = Object.assign( {}, data, { name } );
                db.orgs.insert( newData, function( err, newDoc ) {
                    if ( err ) {
                        res.status( 400 ).send( { message: err } );
                        return;
                    }
                    res.send( { message: "success", org: newDoc } );
                } );
            } )
            .catch( function( err ) {
                res.status( 400 ).send( { message: err.message } );
            } );
    };

    const put = function( req, res ) {
        Joi.validate( req.body, orgSchema )
            .then( function( data ) {
                db.orgs.update( { _id: req.params.id }, data, {}, function( err, numReplaced ) {
                    if ( err ) {
                        res.status( 400 ).send( { message: err } );
                        return;
                    }
                    res.send( { message: "success", numReplaced } );
                } );
            } )
            .catch( function( err ) {
                res.status( 400 ).send( { message: err.message } );
            } );
    };

    function convertNameToSlug ( name ) {
        return name.toLowerCase().split( " " ).join( "-" );
    }

    return {
        get,
        getOneById,
        deleteItem,
        post,
        put
    };
};
