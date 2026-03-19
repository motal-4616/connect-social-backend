const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const authRoutes = require("./routes/auth.routes");
const userRoutes = require("./routes/user.routes");
const postRoutes = require("./routes/post.routes");
const friendRoutes = require("./routes/friend.routes");
const messageRoutes = require("./routes/message.routes");
const notificationRoutes = require("./routes/notification.routes");
const searchRoutes = require("./routes/search.routes");
const storyRoutes = require("./routes/story.routes");
const pusher = require("./lib/pusher");
const { auth } = require("./middleware/auth.middleware");
const { errorHandler } = require("./middleware/error.middleware");

const app = express();

// Middleware
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(morgan("dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/posts", postRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/search", searchRoutes);
app.use("/api/stories", storyRoutes);

// Pusher private channel authentication
app.post("/api/pusher/auth", auth, (req, res) => {
    const authResponse = pusher.authorizeChannel(
        req.body.socket_id,
        req.body.channel_name,
        {
            user_id: req.user.id,
        },
    );
    res.json(authResponse);
});

// Error handler
app.use(errorHandler);

module.exports = app;
