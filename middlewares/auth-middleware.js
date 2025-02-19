
const passport = require('passport');

exports.isLoged = (req,res,next)=>{
    if(!req.session.name){
        res.redirect('/')
        return res.status(401).json({ message: 'Unauthorized: Please log in to access this resource' });
    }
    
    next()
}







exports.handleGoogleAuthError = (req, res, next) => {
  passport.authenticate('google', (err, user, info) => {
    if (err) {
      console.error('Google Auth Error:', err);
      return res.redirect('/user/login');
    }
    if (!user) {
      
      return res.redirect('/user/login');
    }

    
    req.user = user;
    next();
  })(req, res, next);
};