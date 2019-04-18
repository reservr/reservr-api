module.exports = function( config, db ) {
    const getOne = function( req, res ) {
        db.users.findOne( { _id: req.user }, function( err, user ) {
            // remove password from response
            delete user.password;

            if ( err ) {
                res.status( 400 ).send( { message: err } );
                return;
            }

            res.send( { message: "success", user } );
        } );
    };
    return {
        getOne
    };
};
