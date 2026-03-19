const router = require("express").Router();
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");
const { validate } = require("../middleware/validate.middleware");
const { auth } = require("../middleware/auth.middleware");
const ctrl = require("../controllers/auth.controller");

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: "Too many attempts, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

const otpLimiter = rateLimit({
    windowMs: 30 * 60 * 1000, // 30 minutes
    max: 5,
    message: { error: "Too many OTP requests, please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post(
    "/register",
    [
        body("email")
            .isEmail()
            .normalizeEmail()
            .withMessage("Valid email required"),
        body("password")
            .isLength({ min: 6 })
            .withMessage("Password must be at least 6 characters"),
        body("fullName").trim().notEmpty().withMessage("Full name required"),
        body("username")
            .trim()
            .isLength({ min: 3 })
            .matches(/^[a-zA-Z0-9_]+$/)
            .withMessage(
                "Username must be 3+ chars, letters/numbers/underscores only",
            ),
        validate,
    ],
    ctrl.register,
);

router.post(
    "/verify-otp",
    authLimiter,
    [
        body("email").isEmail().normalizeEmail(),
        body("otp")
            .isLength({ min: 6, max: 6 })
            .isNumeric()
            .withMessage("OTP must be 6 digits"),
        validate,
    ],
    ctrl.verifyOtp,
);

router.post(
    "/resend-otp",
    otpLimiter,
    [body("email").isEmail().normalizeEmail(), validate],
    ctrl.resendOtp,
);

router.post(
    "/login",
    authLimiter,
    [
        body("email").isEmail().normalizeEmail(),
        body("password").notEmpty(),
        validate,
    ],
    ctrl.login,
);

router.post(
    "/forgot-password",
    otpLimiter,
    [body("email").isEmail().normalizeEmail(), validate],
    ctrl.forgotPassword,
);

router.post(
    "/reset-password",
    [
        body("email").isEmail().normalizeEmail(),
        body("otp")
            .isLength({ min: 6, max: 6 })
            .isNumeric()
            .withMessage("OTP must be 6 digits"),
        body("newPassword").isLength({ min: 6 }),
        validate,
    ],
    ctrl.resetPassword,
);

router.get("/me", auth, ctrl.getMe);

module.exports = router;
