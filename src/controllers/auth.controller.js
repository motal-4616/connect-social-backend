const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const prisma = require("../lib/prisma");
const {
    sendVerificationEmail,
    sendResetPasswordEmail,
} = require("../lib/brevo");

function generateToken(userId) {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
}

function generateOtp() {
    return crypto.randomInt(100000, 999999).toString();
}

// POST /api/auth/register
async function register(req, res, next) {
    try {
        const { email, password, fullName, username } = req.body;

        const hashedPassword = await bcrypt.hash(password, 12);
        const verifyOtp = generateOtp();
        const verifyOtpExp = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                fullName,
                username,
                verifyOtp,
                verifyOtpExp,
            },
            select: { id: true, email: true, fullName: true, username: true },
        });

        // Send verification OTP email
        try {
            await sendVerificationEmail(email, verifyOtp);
        } catch (emailErr) {
            console.error(
                "Failed to send verification email:",
                emailErr.message,
            );
        }

        const token = generateToken(user.id);

        res.status(201).json({
            message:
                "Account created. Please check your email for the OTP code.",
            token,
            user,
        });
    } catch (error) {
        next(error);
    }
}

// POST /api/auth/verify-otp
async function verifyOtp(req, res, next) {
    try {
        const { email, otp } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or OTP" });
        }

        if (!user.verifyOtp || user.verifyOtp !== otp) {
            return res.status(400).json({ error: "Invalid OTP code" });
        }

        if (!user.verifyOtpExp || user.verifyOtpExp < new Date()) {
            return res
                .status(400)
                .json({ error: "OTP has expired. Please request a new one." });
        }

        await prisma.user.update({
            where: { id: user.id },
            data: { isVerified: true, verifyOtp: null, verifyOtpExp: null },
        });

        res.json({ message: "Email verified successfully" });
    } catch (error) {
        next(error);
    }
}

// POST /api/auth/resend-otp
async function resendOtp(req, res, next) {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({
                message: "If the email exists, a new OTP has been sent.",
            });
        }

        if (user.isVerified) {
            return res.status(400).json({ error: "Email is already verified" });
        }

        const verifyOtp = generateOtp();
        const verifyOtpExp = new Date(Date.now() + 10 * 60 * 1000);

        await prisma.user.update({
            where: { id: user.id },
            data: { verifyOtp, verifyOtpExp },
        });

        try {
            await sendVerificationEmail(email, verifyOtp);
        } catch (emailErr) {
            console.error("Failed to send OTP email:", emailErr.message);
        }

        res.json({ message: "If the email exists, a new OTP has been sent." });
    } catch (error) {
        next(error);
    }
}

// POST /api/auth/login
async function login(req, res, next) {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid email or password" });
        }

        const token = generateToken(user.id);

        res.json({
            token,
            user: {
                id: user.id,
                email: user.email,
                fullName: user.fullName,
                username: user.username,
                avatarUrl: user.avatarUrl,
                isVerified: user.isVerified,
            },
        });
    } catch (error) {
        next(error);
    }
}

// POST /api/auth/forgot-password
async function forgotPassword(req, res, next) {
    try {
        const { email } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.json({
                message: "If the email exists, a reset OTP has been sent.",
            });
        }

        const resetOtp = generateOtp();
        const resetOtpExp = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

        await prisma.user.update({
            where: { id: user.id },
            data: { resetOtp, resetOtpExp },
        });

        try {
            await sendResetPasswordEmail(email, resetOtp);
        } catch (emailErr) {
            console.error("Failed to send reset OTP email:", emailErr.message);
        }

        res.json({
            message: "If the email exists, a reset OTP has been sent.",
        });
    } catch (error) {
        next(error);
    }
}

// POST /api/auth/reset-password
async function resetPassword(req, res, next) {
    try {
        const { email, otp, newPassword } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(400).json({ error: "Invalid email or OTP" });
        }

        if (!user.resetOtp || user.resetOtp !== otp) {
            return res.status(400).json({ error: "Invalid OTP code" });
        }

        if (!user.resetOtpExp || user.resetOtpExp < new Date()) {
            return res
                .status(400)
                .json({ error: "OTP has expired. Please request a new one." });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                password: hashedPassword,
                resetOtp: null,
                resetOtpExp: null,
            },
        });

        res.json({ message: "Password reset successfully" });
    } catch (error) {
        next(error);
    }
}

// GET /api/auth/me
async function getMe(req, res, next) {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: {
                id: true,
                email: true,
                fullName: true,
                username: true,
                bio: true,
                avatarUrl: true,
                isVerified: true,
                createdAt: true,
                _count: {
                    select: {
                        posts: true,
                        sentRequests: true,
                        receivedRequests: true,
                    },
                },
            },
        });
        res.json(user);
    } catch (error) {
        next(error);
    }
}

module.exports = {
    register,
    login,
    verifyOtp,
    resendOtp,
    forgotPassword,
    resetPassword,
    getMe,
};
