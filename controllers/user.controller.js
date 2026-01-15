const userModel = require('../models/user.model');
const userService = require('../services/user.service');
const { validationResult } = require('express-validator');
const blacklistTokenModel = require('../models/blacklistToken.model');

const isProd = process.env.NODE_ENV === 'production';
const cookieOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/'
};

module.exports.registerUser = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0];
        return res.status(400).json({ 
            message: 'Validation failed',
            description: `${firstError.msg} for field: ${firstError.path}`,
            errors: errors.array() 
        });
    }

    const { fullname, email, password } = req.body;

    const isUserAlready = await userModel.findOne({ email });

    if (isUserAlready) {
        return res.status(400).json({ 
            message: 'Email already registered',
            description: 'This email address is already associated with an account. Please login or use a different email.' 
        });
    }

    const hashedPassword = await userModel.hashPassword(password);

    const user = await userService.createUser({
        firstname: fullname.firstname,
        lastname: fullname.lastname,
        email,
        password: hashedPassword
    });

    const token = user.generateAuthToken();
    res.cookie('token', token, cookieOptions);
    res.status(201).json({ token, user });
}

module.exports.loginUser = async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const firstError = errors.array()[0];
        return res.status(400).json({ 
            message: 'Invalid input',
            description: `${firstError.msg} for field: ${firstError.path}`,
            errors: errors.array() 
        });
    }

    const { email, password } = req.body;

    const user = await userModel.findOne({ email }).select('+password');

    if (!user) {
        return res.status(401).json({ 
            message: 'Login failed',
            description: 'No account found with this email address. Please check your email or sign up for a new account.' 
        });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
        return res.status(401).json({ 
            message: 'Login failed',
            description: 'The password you entered is incorrect. Please try again or reset your password.' 
        });
    }
    const token = user.generateAuthToken();
    res.cookie('token', token, cookieOptions);
    res.status(200).json({ token, user });
}

module.exports.getUserProfile = async (req, res, next) => {
    res.status(200).json(req.user);
}

module.exports.logoutUser = async (req, res, next) => {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    res.clearCookie('token', { ...cookieOptions, maxAge: 0 });

    await blacklistTokenModel.create({ token });

    res.status(200).json({ message: 'Logged out' });
}