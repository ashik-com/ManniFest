const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/userSchema')
const session = require('express-session')
const { v4: uuidv4 } = require('uuid');
const { Strategy } = require('passport-google-oauth20')
const env = require('dotenv').config()



passport.use(
  new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
  },
    async (accessToken, refreshToken, profile, done) => {
      try {
        let user = await User.findOne({ email: profile.emails[0].value });

        if (!user) {

          const generateReferralCode = async () => {
            const baseCode = uuidv4().substr(0, 8).toUpperCase();
            const randomNum = Math.floor(1000 + Math.random() * 9000);
            const referralCode = `${baseCode}${randomNum}`;

            const existingUser = await User.findOne({ referralCode });
            if (existingUser) {
              return await generateReferralCode(); // Recursively generate new code if collision
            }
            return referralCode;
          }

          const uniqueReferralCode = await generateReferralCode();

          user = new User({
            google_Id: profile.id,
            email: profile.emails[0].value,
            name: profile.displayName,
            referralCode: uniqueReferralCode,

          })
          await user.save();
        }
        done(null, user);

      } catch (error) {
        done(error, null)

      }
    }
  )

)

passport.serializeUser((user, done) => {
  done(null, user.id);
});


passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

exports.redirectToGoogle = passport.authenticate('google', {
  scope: ['profile', 'email'],
});

exports.handleGoogleCallback = (req, res) => {

  req.logIn(req.user, (err) => {
    if (err) {
      console.error('Login Error:', err);
      return res.redirect('/user/login');
    }


    req.session.name = req.user.name;
    req.session.email = req.user.email;



    return res.redirect('/');
  });
};

